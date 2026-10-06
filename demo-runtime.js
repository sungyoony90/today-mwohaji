// Public, read-only course demo: no production identity, APIs or analytics.
window.__MOA_RELEASE__ = true;
window.__MOA_NATIVE__ = false;
let preferences = null;
const unavailable = async () => { throw new Error('과제 체험판에서는 사진 저장·공개 기능을 제공하지 않아요.'); };
window.MoaData = {
  restore: async () => ({visits:[], publicVisits:[], totals:{}, liked:[], preferences}),
  savePreferences: async value => { preferences = structuredClone(value); },
  saveVisit: unavailable, setPublic: unavailable, deleteVisit: unavailable,
  setLike: unavailable, report: unavailable,
};
const fetchOriginal = window.fetch.bind(window);
window.fetch = (input, options) => typeof input === 'string' && input.startsWith('/api/')
  ? Promise.resolve(new Response(JSON.stringify({error:'체험판에서는 실시간 API를 제공하지 않아요.'}), {status:503,headers:{'Content-Type':'application/json'}}))
  : fetchOriginal(input, options);
document.addEventListener('DOMContentLoaded', () => {
  const notice = document.createElement('aside');
  notice.textContent = '과제 체험판 · 장소 탐색 가능 / 실시간 정보·사진 업로드 제외';
  notice.style.cssText = 'max-width:430px;margin:auto;padding:10px 20px;background:#eaf5ee;color:#407d5e;font:13px/1.5 system-ui;text-align:center';
  document.body.prepend(notice);
  document.addEventListener('click', event => {
    const target = event.target.closest('button,input');
    if (!target) return;
    const action = target.dataset.action || '';
    if (/verify|photo|camera/.test(action) || target.type === 'file' || action === 'toggle-ga-consent') {
      event.preventDefault(); event.stopImmediatePropagation();
      window.alert('과제 체험판에서는 사진 업로드·방문 인증·분석 수집을 사용하지 않아요.');
    }
  }, true);
});
