import { createClient } from 'npm:@supabase/supabase-js@2.110.7';
import { IdentityError, exchangeTossCode, identityDigest, connectIdentity } from './identity-core.js';

const allowedOrigins = new Set([
  'https://summer-mwohaji.apps.tossmini.com',
  'https://summer-mwohaji.private-apps.tossmini.com',
  'https://summer-mwohaji.web.tossmini.com',
  'https://summer-mwohaji.private-web.tossmini.com',
]);
const env = (name: string) => Deno.env.get(name) || '';
const supabaseUrl = env('SUPABASE_URL');
const admin = createClient(supabaseUrl, env('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const checked = (reply: any) => {
  if (reply.error) throw new IdentityError('STORAGE_UNAVAILABLE');
  return reply.data;
};
const store = {
  byDigest: async (digest: string) => checked(await admin.from('moa_toss_identity_v2').select('user_id').eq('key_digest', digest).maybeSingle()),
  byUser: async (id: string) => checked(await admin.from('moa_toss_identity_v2').select('user_id').eq('user_id', id).maybeSingle()),
  claim: async (digest: string, id: string) => {
    const reply = await admin.from('moa_toss_identity_v2').insert({ key_digest: digest, user_id: id });
    if (reply.error && reply.error.code !== '23505') throw new IdentityError('STORAGE_UNAVAILABLE');
    return store.byDigest(digest);
  },
  hasRecords: async (id: string) => {
    const tables = ['moa_visits_v2', 'moa_preferences_v2', 'moa_likes_v2', 'moa_reports_v2'];
    const replies = await Promise.all(tables.map(table => admin.from(table).select('user_id').eq('user_id', id).limit(1)));
    return replies.some(reply => checked(reply).length > 0);
  },
};

Deno.serve(async request => {
  const origin = request.headers.get('origin');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
  };
  if (origin && allowedOrigins.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (origin && !allowedOrigins.has(origin)) return reply({ error: 'ORIGIN_NOT_ALLOWED' }, 403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return reply({ error: 'METHOD_NOT_ALLOWED' }, 405);
  try {
    const authorization = request.headers.get('authorization') || '';
    if (!/^Bearer [^\s]+$/.test(authorization)) throw new IdentityError('AUTH_REQUIRED', 401);
    const authReply = await admin.auth.getUser(authorization.slice(7));
    if (authReply.error || !authReply.data.user) throw new IdentityError('AUTH_REQUIRED', 401);
    const currentUser = authReply.data.user;
    if (Number(request.headers.get('content-length')) > 2048) throw new IdentityError('INVALID_REQUEST', 400);
    const raw = await request.text();
    if (raw.length > 2048) throw new IdentityError('INVALID_REQUEST', 400);
    let body;
    try { body = JSON.parse(raw); } catch { throw new IdentityError('INVALID_REQUEST', 400); }
    if (!body || typeof body.code !== 'string' || !body.code || body.code.length > 1024 || Object.keys(body).some(key => key !== 'code')) {
      throw new IdentityError('INVALID_REQUEST', 400);
    }
    const allowed = checked(await admin.rpc('moa_take_identity_attempt_v2', { owner: currentUser.id }));
    if (!allowed) throw new IdentityError('RATE_LIMITED', 429);
    const cert = env('TOSS_MTLS_CERT'), key = env('TOSS_MTLS_KEY');
    if (!cert || !key) throw new IdentityError('SERVER_NOT_READY');
    const httpClient = Deno.createHttpClient({ cert, key });
    let anonKey;
    try { anonKey = await exchangeTossCode(body.code, fetch, httpClient); }
    finally { httpClient.close(); }
    const digest = await identityDigest(anonKey);
    const result = await connectIdentity({
      currentUser, digest, store,
      admin: {
        getUser: async (id: string) => checked(await admin.auth.admin.getUserById(id)).user,
        upgrade: async (id: string, email: string) => checked(await admin.auth.admin.updateUserById(id, { email, email_confirm: true })),
      },
      issueSession: async (email: string, expectedId: string) => {
        const link = checked(await admin.auth.admin.generateLink({ type: 'magiclink', email }));
        if (link.user?.id !== expectedId || !link.properties?.hashed_token) throw new IdentityError('SESSION_FAILED');
        // Generates no mail. Consume once server-side; only session tokens go to the verified caller.
        const auth = createClient(supabaseUrl, env('SUPABASE_ANON_KEY'), { auth: { persistSession: false, autoRefreshToken: false } });
        return checked(await auth.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'email' })).session;
      },
    });
    return reply(result);
  } catch (error) {
    // Never log auth codes, user keys, tokens, PEM values, or upstream error bodies.
    const safe = error instanceof IdentityError ? error : new IdentityError('SERVICE_UNAVAILABLE');
    return reply({ error: safe.code }, safe.status);
  }
});
