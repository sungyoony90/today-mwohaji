const bucket = 'moa-visits-v2';
const fields = 'id,place,description,region,spot_id,custom,address,place_coords,photo_path,is_public,created_at';

function check(reply) {
  if (reply.error) throw reply.error;
  return reply.data;
}

export function createMoaData(client, encodePhoto, { ensureIdentity = null } = {}) {
  let signingIn;
  let preferenceQueue = Promise.resolve();
  let restored = !ensureIdentity;

  async function existingUser() {
    const data = check(await client.auth.getSession());
    return data.session?.user || null;
  }

  async function user() {
    if (ensureIdentity) {
      if (!restored) throw new Error('기록을 불러온 뒤 다시 시도해 주세요.');
      return ensureIdentity();
    }
    const existing = await existingUser();
    if (existing) return existing;
    signingIn ||= client.auth.signInAnonymously().then(reply => {
      const signed = check(reply);
      if (!signed.user || !signed.session) throw new Error('자동 계정을 만들지 못했어요.');
      return signed.user;
    }).finally(() => { signingIn = null; });
    return signingIn;
  }

  async function photos(rows) {
    if (!rows.length) return [];
    const urls = check(await client.storage.from(bucket).createSignedUrls(rows.map(row => row.photo_path), 60));
    return rows.flatMap((row, index) => {
      if (!urls[index]?.signedUrl) return [];
      return [{
        id: row.id, place: row.place, description: row.description,
        region: row.region, spotId: row.spot_id, custom: row.custom,
        address: row.address, addressCoords: row.place_coords,
        photo: urls[index].signedUrl, isPublic: row.is_public, createdAt: row.created_at,
      }];
    });
  }

  return {
    async restore() {
      const owner = ensureIdentity ? await ensureIdentity() : await existingUser();
      const [publicReply, totalsReply] = await Promise.all([
        client.from('moa_visits_v2').select(fields).eq('is_public', true).eq('moderation_status', 'active').order('created_at', { ascending: false }).limit(50),
        client.from('moa_like_totals_v2').select('moment_id,total').limit(1000),
      ]);
      const publicVisits = await photos(check(publicReply));
      let visits = [], preferences = null, liked = [];
      if (owner) {
        const replies = await Promise.all([
          client.from('moa_visits_v2').select(fields).eq('user_id', owner.id).order('created_at', { ascending: false }).limit(1000),
          client.from('moa_preferences_v2').select('*').eq('user_id', owner.id).maybeSingle(),
          client.from('moa_likes_v2').select('moment_id').eq('user_id', owner.id).limit(1000),
        ]);
        visits = await photos(check(replies[0]));
        preferences = check(replies[1]);
        liked = check(replies[2]).map(row => row.moment_id);
      }
      // After a recovered session, do not retain another session's local defaults.
      if (ensureIdentity && !preferences && !owner.moaRetainLocal) preferences = { saved_spots: [], saved_moments: [], discovery_records: [], moa_look: 'explorer' };
      restored = true;
      return { visits, publicVisits, preferences, liked, totals: Object.fromEntries(check(totalsReply).map(row => [row.moment_id, row.total])) };
    },

    async addVisit(record) {
      const owner = await user();
      const id = crypto.randomUUID();
      const photoPath = `${owner.id}/${id}.jpg`;
      const blob = await encodePhoto(record.photo);
      check(await client.storage.from(bucket).upload(photoPath, blob, { contentType: 'image/jpeg', upsert: false }));
      const reply = await client.from('moa_visits_v2').insert({
        id, place: record.place.trim().slice(0, 100), description: (record.description || '').slice(0, 100),
        region: (record.region || '').slice(0, 80), spot_id: (record.spotId || '').slice(0, 120),
        custom: record.custom === true, address: (record.address || '').slice(0, 200),
        place_coords: record.addressCoords || null, photo_path: photoPath, is_public: record.isPublic === true,
      }).select(fields).single();
      if (reply.error) {
        await client.storage.from(bucket).remove([photoPath]);
        throw reply.error;
      }
      // The insert is already durable even if URL issuance fails afterwards.
      return { ...record, id, createdAt: reply.data.created_at, photo: record.photo, cloudSaved: true };
    },

    savePreferences(preferences) {
      // Capture the snapshot now; serialize writes so rapid taps cannot reorder them.
      const snapshot = structuredClone(preferences);
      const operation = preferenceQueue.catch(() => {}).then(async () => {
        const owner = await user();
        check(await client.from('moa_preferences_v2').upsert({ user_id: owner.id, ...snapshot }));
      });
      preferenceQueue = operation;
      return operation;
    },

    async setLike(id, enabled) {
      const owner = await user();
      if (enabled) {
        const reply = await client.from('moa_likes_v2').insert({ moment_id: id });
        if (reply.error?.code !== '23505') check(reply);
      } else {
        check(await client.from('moa_likes_v2').delete().eq('user_id', owner.id).eq('moment_id', id));
      }
      return check(await client.from('moa_like_totals_v2').select('total').eq('moment_id', id).maybeSingle())?.total || 0;
    },

    async setPublic(id, enabled) {
      const owner = await user();
      const row = check(await client.from('moa_visits_v2').update({ is_public: enabled }).eq('id', id).eq('user_id', owner.id).select('id').single());
      return row.id;
    },

    async deleteVisit(id) {
      const owner = await user();
      const row = check(await client.from('moa_visits_v2').select('photo_path').eq('id', id).eq('user_id', owner.id).single());
      // Withdraw before file deletion. Failed cleanup stays private and retryable.
      check(await client.from('moa_visits_v2').update({ is_public: false }).eq('id', id).eq('user_id', owner.id));
      check(await client.storage.from(bucket).remove([row.photo_path]));
      check(await client.from('moa_visits_v2').delete().eq('id', id).eq('user_id', owner.id));
    },

    async report(id, reason) {
      await user();
      const reply = await client.from('moa_reports_v2').insert({ moment_id: id, reason });
      if (reply.error?.code !== '23505') check(reply);
    },
  };
}
