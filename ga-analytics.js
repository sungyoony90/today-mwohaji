export const GA_ID = 'G-0000000000';
const ORIGIN = 'https://summer-mwohaji.apps.tossmini.com';
const LIVE_ORIGINS = new Set([ORIGIN, 'https://summer-mwohaji.web.tossmini.com']);
const CONSENT_KEY = 'moa-ga-consent-v1';
const screens = new Set(['home','my','saved','moments','moment-detail','liked-moments','condition','browse','result','search','friends','dogam','map','visit-history','visit-detail']);
const events = new Set(['app_opened','screen_viewed','tab_selected','activity_selected','experience_selected','recommendation_started','recommendation_impression','place_detail_viewed','place_selected','place_save_completed','place_unsave_completed','map_link_clicked','share_clicked','share_completed','verification_started','verification_failed','photo_selected','visit_record_submitted','visit_record_completed','visit_record_failed','daily_discovery_collected','moa_look_unlocked','location_requested','location_completed','location_failed','empty_result_viewed']);
['recommendation_step_viewed','recommendation_step_completed','recommendation_results_viewed','companion_selected','place_save_failed'].forEach(name => events.add(name));
const enumFields = {
  step: ['preferences','region'],
  failure_reason: ['persistence_failed','location_unavailable','location_or_eligibility_check_failed','insufficient_accuracy','region_lookup_failed','permission_denied','location_unavailable_or_timeout'],
  companion: ['any','alone','friends','couple'],
  activity: ['all','autumn','water','books','cafe','walk','culture','activity','running','exhibition','photography'],
  photo_source: ['camera','album'],
  selection_surface: ['recommendation','search','saved','alternative'],
};

// Only our published campaign vocabulary is accepted, never arbitrary URL text.
export function gaCampaign(search = '') {
  const params = new URLSearchParams(search);
  const keys = ['utm_source','utm_medium','utm_campaign','utm_content'];
  if (keys.some(key => params.getAll(key).length !== 1)) return {};
  if (params.get('utm_source') !== 'instagram' || params.get('utm_medium') !== 'organic_social' || params.get('utm_campaign') !== 'launch') return {};
  const content = params.get('utm_content');
  if (content !== 'profile' && !/^story_\d{2}$/.test(content)) return {};
  return { campaign_source:'instagram', campaign_medium:'organic_social', campaign_name:'launch', campaign_content:content };
}

// No free text, URLs, place IDs, user IDs, photos or location values cross this boundary.
export function gaEvent(event) {
  if (!event || !events.has(event.event_name)) return null;
  const params = {};
  if (screens.has(event.screen)) params.screen = event.screen;
  for (const key of ['result_count','result_position','total_cards']) {
    if (Number.isInteger(event[key]) && event[key] >= 0 && event[key] < 100000) params[key] = event[key];
  }
  if (typeof event.has_reflection === 'boolean') params.has_reflection = event.has_reflection;
  for (const [key, values] of Object.entries(enumFields)) {
    if (values.includes(event[key])) params[key] = event[key];
  }
  return { name: event.event_name, params };
}

export function installGA(win, doc, native) {
  const eligible = native && LIVE_ORIGINS.has(win.location.origin);
  const campaign = gaCampaign(win.location.search);
  let consent = false;
  let started = false;
  let failed = false;
  let loaded = false;
  let lastScreen = '';
  try { consent = win.localStorage.getItem(CONSENT_KEY) === 'granted'; } catch {}
  function gtag() { win.dataLayer.push(arguments); }
  function start() {
    if (!eligible || !consent || started) return;
    started = true;
    win.dataLayer = win.dataLayer || [];
    win.gtag = gtag;
    win[`ga-disable-${GA_ID}`] = false;
    gtag('consent','default',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
    gtag('js',new Date());
    gtag('config',GA_ID,{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false,page_location:ORIGIN+'/',page_referrer:'',page_title:'오늘 뭐하지',cookie_domain:'none',...campaign});
    const script=doc.createElement('script');
    script.async=true;
    script.src=`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    script.referrerPolicy='no-referrer';
    script.onload=()=>{loaded=true;};
    script.onerror=()=>{failed=true; win.dataLayer.length=0;};
    doc.head.appendChild(script);
  }
  const api = {
    enabled:()=>consent,
    setEnabled(value) {
      consent=Boolean(value);
      try { win.localStorage.setItem(CONSENT_KEY,consent?'granted':'denied'); } catch {}
      if (!eligible) return;
      win[`ga-disable-${GA_ID}`]=!consent;
      if (started) gtag('consent','update',{analytics_storage:consent?'granted':'denied'});
      else start();
      lastScreen='';
    },
  };
  win.addEventListener('today-mwohaji:analytics',({detail})=>{
    if (!eligible || !consent || failed) return;
    const event=gaEvent(detail);
    if (!event) return;
    try {
      start();
      // Bound the pending queue when the Google script is blocked.
      if (!loaded && win.dataLayer.length > 200) return;
      if (event.name==='screen_viewed' && event.params.screen) {
        if (lastScreen===event.params.screen) return;
        lastScreen=event.params.screen;
        gtag('set',{page_location:ORIGIN+'/'+lastScreen,page_title:lastScreen,page_referrer:''});
        gtag('event','page_view',{send_to:GA_ID,page_location:ORIGIN+'/'+lastScreen,page_title:lastScreen,page_referrer:''});
      }
      gtag('event',event.name,{...event.params,send_to:GA_ID});
    } catch { /* Analytics must never block the app. */ }
  });
  try { start(); } catch { failed=true; }
  return api;
}
