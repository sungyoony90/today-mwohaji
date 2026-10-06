// This module runs ONLY on the server. Never import it from the web runtime.
export class IdentityError extends Error {
  constructor(code, status = 503) { super(code); this.code = code; this.status = status; }
}

export async function exchangeTossCode(code, fetcher, httpClient) {
  const response = await fetcher('https://apps-in-toss-api.toss.im/api-partner/v1/apps-in-toss/users/anon-key/exchange', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }), client: httpClient,
    redirect: 'error', signal: AbortSignal.timeout(10000),
  });
  const body = await response.json();
  // Toss returns business failures with HTTP 200, not only HTTP errors.
  if (!response.ok || body.resultType !== 'SUCCESS') {
    if (body.error?.errorCode === '4011') throw new IdentityError('CODE_EXPIRED', 401);
    if (body.error?.errorCode === '4095') throw new IdentityError('RATE_LIMITED', 429);
    throw new IdentityError('TOSS_UNAVAILABLE');
  }
  if (typeof body.success?.anonKey !== 'string' || !body.success.anonKey || body.success.anonKey.length > 512) {
    throw new IdentityError('INVALID_TOSS_RESPONSE');
  }
  return body.success.anonKey;
}

export async function identityDigest(anonKey) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`summer-mwohaji:toss:${anonKey}`));
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function connectIdentity({ currentUser, digest, store, admin, issueSession }) {
  // A client-supplied user ID, hash or user_metadata is NEVER identity proof.
  let binding = await store.byDigest(digest);
  if (!binding) {
    const other = await store.byUser(currentUser.id);
    if (other || !currentUser.is_anonymous || currentUser.email || currentUser.phone) {
      throw new IdentityError('ACCOUNT_CONFLICT', 409);
    }
    binding = await store.claim(digest, currentUser.id);
  }
  if (!binding?.user_id) throw new IdentityError('ACCOUNT_CONFLICT', 409);
  if (binding.user_id !== currentUser.id) {
    // Never discard or silently merge a second device's existing records.
    const other = await store.byUser(currentUser.id);
    if (other || !currentUser.is_anonymous || await store.hasRecords(currentUser.id)) {
      throw new IdentityError('ACCOUNT_CONFLICT', 409);
    }
  }
  const canonical = await admin.getUser(binding.user_id);
  // Internal non-deliverable alias: no real email/name/phone is collected.
  const email = `${digest}@toss-users.invalid`;
  if (canonical.email && canonical.email !== email || canonical.phone) {
    throw new IdentityError('ACCOUNT_CONFLICT', 409);
  }
  if (!canonical.email || canonical.is_anonymous) {
    await admin.upgrade(canonical.id, email);
  }
  const session = await issueSession(email, canonical.id);
  if (!session?.access_token || !session.refresh_token || session.user?.id !== canonical.id) {
    throw new IdentityError('SESSION_FAILED');
  }
  return { access_token: session.access_token, refresh_token: session.refresh_token, user_id: canonical.id };
}
