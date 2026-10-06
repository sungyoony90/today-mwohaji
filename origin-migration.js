const MARKER = 'moa-origin-migration-v1';
const RECORDS = 'today-mwohaji-verified-discovery-cards-v2';
const KEYS = [RECORDS, 'today-mwohaji-discovery-cards-v1', 'today-mwohaji-moa-look-v1'];

// Do not transfer credentials, analytics consent, precise location or unknown keys.
export async function migrateOriginStorage({ native, origin, storage, getDump, timeoutMs = 4000 }) {
  if (!native || origin !== 'https://summer-mwohaji.apps.tossmini.com') return 'skipped';
  let timer;
  try {
    if (storage.getItem(MARKER) === 'done') return 'done';
    const dump = await Promise.race([
      getDump(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), timeoutMs); }),
    ]);
    const previous = dump?.previous;
    if (previous?.origin !== 'https://summer-mwohaji.web.tossmini.com' || dump?.current?.origin !== origin ||
        !previous.localStorage || previous.errors?.some(error => error.storage === 'localStorage')) return 'retry';
    for (const key of KEYS) {
      const old = previous.localStorage[key];
      if (typeof old !== 'string') continue;
      const current = storage.getItem(key);
      if (key === 'today-mwohaji-moa-look-v1') {
        if (current === null && /^[a-z-]{1,40}$/.test(old)) storage.setItem(key, old);
        continue;
      }
      const incoming = JSON.parse(old);
      if (!Array.isArray(incoming)) return 'retry';
      if (current === null) storage.setItem(key, JSON.stringify(incoming));
      else if (key === RECORDS) {
        const existing = JSON.parse(current);
        if (!Array.isArray(existing)) return 'retry';
        const byDate = new Map();
        for (const item of [...incoming, ...existing]) {
          if (item && typeof item.date === 'string' && item.verificationType === 'gps-photo' && typeof item.spotId === 'string') byDate.set(item.date, item);
        }
        storage.setItem(key, JSON.stringify([...byDate.values()].sort((a,b) => a.date.localeCompare(b.date)).slice(-365)));
      }
    }
    storage.setItem(MARKER, 'done');
    return 'done';
  } catch { return 'retry'; }
  finally { clearTimeout(timer); }
}
