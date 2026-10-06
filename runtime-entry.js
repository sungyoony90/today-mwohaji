import { createClient } from '@supabase/supabase-js';
import { Device, Environment, Storage, Analytics, graniteEvent, Screen, User, Migration } from '@apps-in-toss/web-framework';
import { migrateOriginStorage } from './origin-migration.js';
import { createMoaData } from './data-service.js';
import { installNativeBackBridge } from './native-back.js';
import { deliverAnalytics } from './analytics-adapter.js';
import { installGA } from './ga-analytics.js';
import { createTossIdentity } from './toss-identity.js';

export const SUPABASE_URL = 'https://your-project.supabase.co';
// A publishable key, never a service-role key. All writes are protected by RLS.
export const SUPABASE_KEY = 'sb_publishable_example_for_course_submission';
let native = false;
try { native = ['toss', 'sandbox'].includes(Environment.environment); } catch { /* browser preview */ }
window.__MOA_NATIVE__ = native;
window.__MOA_STORAGE_READY__ = migrateOriginStorage({ native, origin: location.origin, storage: window.localStorage, getDump: () => Migration.getOriginStorage() });
window.MoaAnalytics = installGA(window, document, native);
window.__MOA_RELEASE__ = !['127.0.0.1', 'localhost'].includes(location.hostname) && location.protocol !== 'file:';

const storage = native ? {
  getItem: key => Storage.getItem(key),
  setItem: (key, value) => Storage.setItem(key, value),
  removeItem: key => Storage.removeItem(key),
} : window.localStorage;
const client = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { storage, storageKey: 'moa-v2-auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

export async function encodePhoto(source) {
  const image = new Image();
  image.src = source;
  await image.decode();
  if (!image.naturalWidth || image.naturalWidth * image.naturalHeight > 50000000) throw new Error('사진 크기가 너무 커요. 작은 사진을 선택해 주세요.');
  const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('사진을 처리할 수 없어요.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  // Re-encoding removes the input file's EXIF/GPS metadata.
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82));
  if (!blob || blob.size > 5 * 1024 * 1024) throw new Error('사진을 줄이지 못했어요. 다른 사진을 선택해 주세요.');
  return blob;
}

const ensureIdentity = native ? createTossIdentity({
  client, getAuthCode: () => User.createAnonymousKeyAuthCode(),
  fetcher: window.fetch.bind(window), url: SUPABASE_URL, publishableKey: SUPABASE_KEY,
}) : null;
window.MoaData = createMoaData(client, encodePhoto, { ensureIdentity });
if (native) {
  const backBridgeError = () => {
    window.dispatchEvent(new CustomEvent('today-mwohaji:native-back-error'));
  };
  try {
    installNativeBackBridge({
      events: graniteEvent,
      dispatchBack: () => {
        const event = new CustomEvent('today-mwohaji:native-back', { cancelable: true });
        window.dispatchEvent(event);
        return event.defaultPrevented;
      },
      close: () => Screen.close(),
      onError: backBridgeError,
    });
  } catch { backBridgeError(); }
  window.__AIT_OPEN_URL__ = url => Device.openURL(url);
  window.__AIT_GET_CURRENT_LOCATION__ = Device.getLocation;
  window.MoaNativePhoto = async camera => {
    const result = camera ? await Device.openCamera({ base64: true, maxWidth: 1600 }) : (await Device.getPhotos({ base64: true, maxWidth: 1600, maxCount: 1 }))[0];
    if (!result) return '';
    return result.dataUri.startsWith('data:') ? result.dataUri : `data:image/jpeg;base64,${result.dataUri}`;
  };
  window.addEventListener('today-mwohaji:analytics', event => {
    deliverAnalytics(payload => Analytics.log(payload), event.detail);
  });
}

// Bundled clients cannot call the developer's localhost. Read APIs use HTTPS.
const publicApi = `${SUPABASE_URL}/functions/v1/moa-public-api`;
const originalFetch = window.fetch.bind(window);
if (window.__MOA_RELEASE__) {
  window.fetch = (input, options) => {
    if (typeof input === 'string' && input.startsWith('/api/')) {
      return originalFetch(`${publicApi}${input}`, { ...options, headers: { ...options?.headers, apikey: SUPABASE_KEY } });
    }
    return originalFetch(input, options);
  };
}
