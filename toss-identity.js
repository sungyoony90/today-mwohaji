// Client owns only its session. Proof and account binding happen on the server.
const messages = {
  ACCOUNT_CONFLICT: '이 기기의 기록과 연결된 계정이 달라요. 기존 기록은 그대로 보관했어요.',
  RATE_LIMITED: '계정 확인 요청이 많아요. 잠시 후 앱을 다시 열어 주세요.',
  CODE_EXPIRED: '계정 확인 시간이 만료됐어요. 앱을 다시 열어 주세요.',
};
const failure = code => Object.assign(new Error(messages[code] || '계정을 확인하지 못했어요. 연결을 확인하고 앱을 다시 열어 주세요.'), { code: 'MOA_IDENTITY' });

export function createTossIdentity({ client, getAuthCode, fetcher, url, publishableKey }) {
  let pending;
  let linkedUser;
  return function ensureIdentity() {
    if (linkedUser) return Promise.resolve(linkedUser);
    // Concurrent reads/writes must not create or switch multiple accounts.
    pending ||= (async () => {
      let { data, error } = await client.auth.getSession();
      if (error) throw failure('SESSION_FAILED');
      let session = data.session;
      const hadSession = Boolean(session);
      if (!session) {
        const reply = await client.auth.signInAnonymously();
        if (reply.error || !reply.data.session) throw failure('SESSION_FAILED');
        session = reply.data.session;
      }
      let result;
      for (let attempt = 0; attempt < 2; attempt++) {
        let timer;
        const codeReply = await Promise.race([
          getAuthCode(),
          new Promise((_, reject) => { timer = setTimeout(() => reject(failure('SDK_TIMEOUT')), 15000); }),
        ]).finally(() => clearTimeout(timer));
        if (!codeReply?.code || typeof codeReply.code !== 'string') throw failure('CODE_EXPIRED');
        const reply = await fetcher(`${url}/functions/v1/moa-user-session`, {
          method: 'POST',
          headers: { apikey: publishableKey, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: codeReply.code }), signal: AbortSignal.timeout(20000),
        });
        result = await reply.json();
        if (result.error === 'CODE_EXPIRED' && attempt === 0) continue;
        if (!reply.ok || result.error) throw failure(result.error);
        break;
      }
      if (!result?.access_token || !result.refresh_token || !result.user_id) throw failure('SESSION_FAILED');
      const signed = await client.auth.setSession({ access_token: result.access_token, refresh_token: result.refresh_token });
      if (signed.error || signed.data.user?.id !== result.user_id) throw failure('SESSION_FAILED');
      linkedUser = { ...signed.data.user, moaRetainLocal: hadSession && session.user.id === result.user_id };
      return linkedUser;
    })().catch(error => {
      // No raw backend/SDK error (which might contain tokens) reaches the UI.
      if (error?.code === 'MOA_IDENTITY') throw error;
      throw failure('SERVICE_UNAVAILABLE');
    }).finally(() => { pending = null; });
    return pending;
  };
}
