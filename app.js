(async function startMoaApp() {
if (window.__MOA_STORAGE_READY__) await window.__MOA_STORAGE_READY__;
(function setupMoaLocationService(global) {
  const BALANCED_ACCURACY = 3;

  function normalize(location) {
    const coords = location?.coords || location;
    return {
      coords: {
        latitude: Number(coords?.latitude),
        longitude: Number(coords?.longitude),
        accuracy: Number(coords?.accuracy),
      },
      timestamp: Number(location?.timestamp) || Date.now(),
    };
  }

  function browserLocation(options) {
    if (!navigator.geolocation) {
      const error = new Error("LOCATION_UNAVAILABLE");
      error.code = "unavailable";
      return Promise.reject(error);
    }
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => resolve(normalize(position)),
        (cause) => {
          const error = new Error(cause?.code === 1 ? "LOCATION_PERMISSION_DENIED" : "LOCATION_FAILED");
          error.code = cause?.code === 1 ? "permission-denied" : cause?.code === 3 ? "timeout" : "failed";
          reject(error);
        },
        options,
      );
    });
  }

  async function appsInTossLocation(sdk, precise) {
    const permission = typeof sdk.getPermission === "function" ? await sdk.getPermission() : "allowed";
    if (permission === "osPermissionDenied") {
      const error = new Error("LOCATION_OS_PERMISSION_DENIED");
      error.code = "os-permission-denied";
      throw error;
    }
    if (permission !== "allowed" && typeof sdk.openPermissionDialog === "function") {
      const result = await sdk.openPermissionDialog();
      if (result !== "allowed") {
        const error = new Error("LOCATION_PERMISSION_DENIED");
        error.code = "permission-denied";
        throw error;
      }
    }
    return normalize(await sdk({ accuracy: precise ? 5 : BALANCED_ACCURACY }));
  }

  global.MoaLocation = Object.freeze({
    async getCurrent(options = {}) {
      // The production Apps-in-Toss entry injects getCurrentLocation here.
      // Localhost intentionally falls back to the browser so the prototype remains testable.
      const sdk = global.__AIT_GET_CURRENT_LOCATION__;
      if (typeof sdk === "function") return appsInTossLocation(sdk, options.precise === true);
      return browserLocation({
        enableHighAccuracy: options.precise === true,
        timeout: options.timeout || 10000,
        maximumAge: options.maximumAge ?? 0,
      });
    },
  });
})(window);

// Unconfigured origin must not contain a developer's address or coordinates.
const PILOT_LOCATION = "위치 설정";
const PILOT_COORDS = null;
// Do not restore v2 prototype origins into the release. Other user data is untouched.
const LOCATION_STORAGE_KEY = "today-mwohaji-origin-v3";
const LOCATION_REGION_STORAGE_KEY = "today-mwohaji-origin-region-v3";
const LOCATION_COORDS_STORAGE_KEY = "today-mwohaji-origin-coords-v3";
const HOME_LOCATION_GATE_DISMISSED_KEY = "today-mwohaji-home-location-gate-dismissed-v1";
const ANALYTICS_SESSION_STORAGE_KEY = "today-mwohaji-analytics-session-v1";
const ANALYTICS_EVENT_NAME = "today-mwohaji:analytics";
const APP_VERSION = "v2-prototype-analytics-v2";
const DISCOVERY_STORAGE_KEY = "today-mwohaji-verified-discovery-cards-v2";
const LEGACY_DISCOVERY_STORAGE_KEY = "today-mwohaji-discovery-cards-v1";
const MOA_LOOK_STORAGE_KEY = "today-mwohaji-moa-look-v1";
const PROTOTYPE_QUERY = new URLSearchParams(window.__MOA_RELEASE__ ? "" : window.location.search);
const MANY_VISITS_PREVIEW = PROTOTYPE_QUERY.get("preview") === "many-visits";
const RECORDED_HOME_PREVIEW = PROTOTYPE_QUERY.get("preview") === "recorded" || MANY_VISITS_PREVIEW;
const INITIAL_PREVIEW_SCREEN = PROTOTYPE_QUERY.get("screen") === "activities" ? "condition" : ["moments", "condition", "my"].includes(PROTOTYPE_QUERY.get("screen")) ? PROTOTYPE_QUERY.get("screen") : "home";
const HOME_CARD_COUNT_PREVIEW = [3, 10, 20].includes(Number(PROTOTYPE_QUERY.get("cards")))
  ? Number(PROTOTYPE_QUERY.get("cards"))
  : null;

function resetSavedLocationFromUrl() {
  const url = new URL(window.location.href);
  if (url.searchParams.get("resetLocation") !== "1") return;
  try {
    localStorage.removeItem(LOCATION_STORAGE_KEY);
    localStorage.removeItem(LOCATION_REGION_STORAGE_KEY);
    localStorage.removeItem(LOCATION_COORDS_STORAGE_KEY);
    sessionStorage.removeItem(HOME_LOCATION_GATE_DISMISSED_KEY);
  } catch { /* 저장소를 사용할 수 없어도 초기 화면은 계속 열어요. */ }
  url.searchParams.delete("resetLocation");
  window.history.replaceState(null, "", url);
}

resetSavedLocationFromUrl();
const moaLooks = [
  { id: "explorer", level: 1, requiredCards: 0, title: "탐험 모아", description: "처음부터 함께하는 모아", image: "assets/moa-base-explorer-v1.png" },
  { id: "photo-garden", level: 2, requiredCards: 3, title: "사진꽃 모아", description: "현장 인증 카드 3장을 모으면 열려요", image: "assets/moa_card_img_3.png" },
  { id: "scrapbook", level: 3, requiredCards: 10, title: "폴라로이드 모아", description: "현장 인증 카드 10장을 모으면 열려요", image: "assets/moa_card_img_2.png" },
  { id: "card-rider", level: 4, requiredCards: 20, title: "카드 라이더 모아", description: "현장 인증 카드 20장을 모으면 열려요", image: "assets/moa_card_img_1.png" },
];
const discoveryThemes = [
  { id: "autumn", title: "가을빛 따라 걷기", prompt: "억새·단풍·가을꽃이 가장 좋은 지금, 계절 풍경을 만나봐요.", interest: "autumn", symbol: "🍁" },
  { id: "walk", title: "가볍게 걷는 하루", prompt: "익숙한 동네에서도 새로운 풍경을 찾아볼까요?", interest: "walk", symbol: "🌿" },
  { id: "culture", title: "새로운 장면 만나기", prompt: "전시나 작은 문화 공간에서 오늘의 기분을 바꿔봐요.", interest: "culture", symbol: "🎨" },
  { id: "books", title: "책과 잠깐 쉬어가기", prompt: "책방이나 북카페에서 나만의 시간을 찾아봐요.", interest: "books", symbol: "📖" },
  { id: "cafe", title: "달콤한 쉼표", prompt: "가보고 싶던 카페 한 곳을 오늘의 후보로 골라봐요.", interest: "cafe", symbol: "☕" },
  { id: "activity", title: "조금 다른 하루", prompt: "평소와 다른 체험 하나를 발견해볼까요?", interest: "activity", symbol: "✨" },
];

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateFromKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);
  return localDateKey(date) === key ? date : null;
}

function readDiscoveryRecords() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DISCOVERY_STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    const seen = new Set();
    return parsed.filter((item) => {
      if (!item || typeof item.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(item.date) || !dateFromKey(item.date) ||
          !discoveryThemes.some((theme) => theme.id === item.themeId) || item.verificationType !== "gps-photo" ||
          typeof item.spotId !== "string" || !item.spotId || seen.has(item.date)) return false;
      seen.add(item.date);
      return true;
    }).sort((a, b) => a.date.localeCompare(b.date)).slice(-365);
  } catch { return []; }
}

function legacyDiscoveryCount() {
  try {
    const records = JSON.parse(localStorage.getItem(LEGACY_DISCOVERY_STORAGE_KEY) || "[]");
    return Array.isArray(records) ? Math.min(records.length, 365) : 0;
  } catch { return 0; }
}

function createAnalyticsSessionId() {
  try {
    const existing = sessionStorage.getItem(ANALYTICS_SESSION_STORAGE_KEY);
    if (existing) return existing;
    const generated = typeof crypto?.randomUUID === "function"
      ? crypto.randomUUID()
      : `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(ANALYTICS_SESSION_STORAGE_KEY, generated);
    return generated;
  } catch {
    return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

const analyticsSessionId = createAnalyticsSessionId();
const analyticsQueue = window.__TODAY_MWOHAJI_ANALYTICS__ ||= [];
const trackedAnalyticsStates = new Set();
let analyticsViewId = 0;
let analyticsScreen = "";
let analyticsCardObserver;

function trackEvent(eventName, properties = {}) {
  const logType = eventName === "screen_viewed" ? "screen" : eventName.endsWith("_failed") || eventName === "error_viewed"
    ? "error"
    : eventName === "recommendation_impression" || eventName === "empty_result_viewed" || eventName === "daily_discovery_presented"
      ? "impression"
      : eventName.endsWith("_completed") || eventName.endsWith("_viewed") || eventName === "app_opened" || eventName === "daily_discovery_collected" || eventName === "moa_look_unlocked" ? "event" : "click";
  const event = {
    event_name: eventName,
    log_type: logType,
    occurred_at: new Date().toISOString(),
    session_id: analyticsSessionId,
    spot_id: properties.spot_id || null,
    result_position: Number.isInteger(properties.result_position) ? properties.result_position : null,
    transport_mode: state.transport,
    app_version: APP_VERSION,
    ...properties,
  };
  analyticsQueue.push(event);
  if (analyticsQueue.length > 500) analyticsQueue.splice(0, analyticsQueue.length - 500);
  window.dispatchEvent(new CustomEvent(ANALYTICS_EVENT_NAME, { detail: event }));
  try {
    const bridge = window.todayMwohajiAnalytics;
    if (typeof bridge?.log === "function") {
      const { event_name: _, log_type, ...params } = event;
      Promise.resolve(bridge.log({ log_name: eventName, log_type, params })).catch(() => {});
    } else {
      bridge?.track?.(eventName, event);
    }
  } catch {
    // 계측 전송기 장애가 사용자 흐름을 막지 않도록 로컬 큐에는 계속 남긴다.
  }
  return event;
}

function trackStateOnce(eventName, stateKey, properties = {}) {
  const key = `${analyticsViewId}:${eventName}:${stateKey}`;
  if (trackedAnalyticsStates.has(key)) return;
  trackedAnalyticsStates.add(key);
  trackEvent(eventName, properties);
}
const initialLocation = (() => {
  try {
    const savedLabel = localStorage.getItem(LOCATION_STORAGE_KEY);
    const label = savedLabel || PILOT_LOCATION;
    const region = localStorage.getItem(LOCATION_REGION_STORAGE_KEY) || (label === PILOT_LOCATION ? "서울" : label);
    const stored = JSON.parse(localStorage.getItem(LOCATION_COORDS_STORAGE_KEY) || "null");
    const coords = stored && Number.isFinite(stored.lat) && Number.isFinite(stored.lng) ? stored : null;
    return { label, region, source: coords ? "selected" : savedLabel ? "manual" : "pilot", coords };
  } catch { return { label: PILOT_LOCATION, region: "서울", source: "pilot" }; }
})();

function createVisitVerification(overrides = {}) {
  return { open: true, step: "place", place: "", photo: "", spotId: "", region: "", custom: false, description: "", isPublic: false, address: "", addressCoords: null, addressLookup: { status: "idle", results: [], message: "" }, ...overrides };
}

const state = {
  screen: INITIAL_PREVIEW_SCREEN,
  transport: "transit",
  interest: "all",
  interestChosen: false,
  companion: "any",
  browseEntryScreen: "condition",
  browseCount: 12,
  activityScope: "nearby",
  shareOpen: false,
  mapPickerSpotId: "",
  location: initialLocation,
  homeLocationGateDismissed: (() => { try { return sessionStorage.getItem(HOME_LOCATION_GATE_DISMISSED_KEY) === "1"; } catch { return false; } })(),
  pendingHomeDestination: "",
  originLookup: { query: "", status: "idle", results: [], message: "" },
  verify: createVisitVerification({ open: false }),
  visitListLimit: 12,
  selectedVisitId: "",
  visitDetailBack: "my",
  explorations: MANY_VISITS_PREVIEW ? Array.from({ length: 24 }, (_, index) => ({
    id: `preview-visit-${index}`,
    place: "사근진해변",
    photo: "assets/moa-moment-peek-v1.png",
    region: "강원 · 강릉",
    description: ["바다를 보며 천천히 걸었던 하루.", "잠깐 쉬어가도 좋았던 순간.", "다시 와서 남기는 오늘의 기록."][index % 3],
    createdAt: new Date(2026, 9, 6 - index * 3, 12).toISOString(),
    isPublic: index % 3 === 0,
  })) : RECORDED_HOME_PREVIEW ? [{
    id: "preview-recorded-moment",
    place: "사근진해변",
    photo: "assets/moa-moment-peek-v1.png",
    region: "강원",
    spotId: "gangneung-sageunjin",
    custom: false,
    createdAt: new Date().toISOString(),
  }] : [],
  regionOpen: false,
  mapRegion: "",
  selectedSpotId: "",
  savedSpotIds: [],
  savedMomentIds: [],
  savedTab: "places",
  likedMomentIds: [],
  publicVisits: [],
  likeTotals: {},
  dataLoading: true,
  dataError: "",
  focusMomentId: "",
  selectedMomentId: "",
  momentDetailBack: "moments",
  momentSort: "latest",
  discoveryRecords: readDiscoveryRecords(),
  weather: { region: "", status: "idle", kind: "" },
  moaLook: (() => { try { return localStorage.getItem(MOA_LOOK_STORAGE_KEY) || "explorer"; } catch { return "explorer"; } })(),
  moaLookSheetOpen: false,
  moaLookLevel: 1,
  openDiscoveryCardDate: "",
  rewardCardFresh: false,
  rewardPreviewOpen: false,
  dogamExpandedRegions: [],
  discoveryManualReady: false,
  discoveryLocationError: "",
  resultBack: "condition",
};

// V2 화면 검토용 작은 도감 목록. 전체 장소와 기존 인증 기록은 출시 앱에 있어요.
const dogamSpots = [
  { id: "forest-greenhouse", title: "서울숲 온실 산책", emoji: "🌿", region: "서울", area: "성수" },
  { id: "seongsu-cafe", title: "성수 카페거리", emoji: "☕", region: "서울", area: "성수" },
  { id: "namsan-tower", title: "남산서울타워 야경", emoji: "🌃", region: "서울", area: "남산" },
  { id: "gyeonggi-heyri", title: "헤이리 예술마을", emoji: "🎨", region: "경기", area: "파주" },
  { id: "gyeonggi-majang", title: "마장호수", emoji: "🌉", region: "경기", area: "파주" },
  { id: "gyeonggi-pyeonghwanuri", title: "임진각 평화누리", emoji: "🎏", region: "경기", area: "파주" },
  { id: "gyeonggi-sihwa", title: "시화나래 조력공원", emoji: "🌅", region: "경기", area: "안산" },
];
const spotDescriptions = {
  "forest-greenhouse": "서울숲의 초록빛 공간을 둘러보는 산책 코스예요.",
  "seongsu-cafe": "성수의 여러 카페를 둘러보며 쉬어갈 수 있어요.",
  "namsan-tower": "남산에서 서울의 야경을 바라볼 수 있어요.",
  "gyeonggi-heyri": "갤러리와 카페가 모인 예술마을이에요.",
  "gyeonggi-majang": "호수와 출렁다리를 따라 걸을 수 있어요.",
  "gyeonggi-pyeonghwanuri": "넓은 공원과 바람개비 언덕을 둘러볼 수 있어요.",
  "gyeonggi-sihwa": "바다 전망을 보며 산책할 수 있는 공원이에요.",
};
// Values are surrounding Seoul city-data areas, not venue-level crowding.
// Keep this allowlist in sync with server.mjs.
const crowdAreaBySpotId = Object.freeze({
  "gyeongbok-night": "경복궁", "yeouido-nightmarket": "여의도한강공원", "ttukseom-picnic": "뚝섬한강공원",
  "jamwon-sup": "잠원한강공원", "seoul-forest": "서울숲공원", "forest-greenhouse": "서울숲공원",
  "seongsu-cafe": "성수동 카페거리", "namsan-tower": "남산공원", "climbing-hongdae": "홍대 관광특구",
  "lotte-aquarium": "잠실 관광특구", "itaewon-rooftop": "이태원 관광특구", "nodeul-island": "노들섬",
  "bukchon-walk": "북촌한옥마을", "board-game-konkuk": "건대입구역", "ddp-night": "DDP(동대문디자인플라자)",
  "hangang-pool": "여의도한강공원", "gwangjang-market": "광장시장", "hangang-cruise": "여의도한강공원",
  "ikseon-dong": "익선동", "naksan-park": "낙산공원·이화마을", "eungbong-night": "응봉산",
  "cheonggye-walk": "종로·청계 관광특구", "seokchon-lake": "잠실 관광특구", "sebitseom": "반포한강공원",
  "byeolmadang": "강남 MICE 관광특구", "hongdae-busking": "홍대 관광특구", "seochon-alley": "서촌",
  "hanul-park": "월드컵공원", "children-grand-park": "어린이대공원", "jazz-evans": "홍대 관광특구",
  "jazz-allthatjazz": "이태원 관광특구", "jeongdong-night": "덕수궁길·정동길",
});
const baseCatalogSpots = Array.isArray(window.SPOT_CATALOG) ? window.SPOT_CATALOG : [];
const dogamCatalogSpots = baseCatalogSpots.filter((spot, index, spots) => spots.findIndex((item) => item.id === spot.id) === index);
const seasonalSpots = Array.isArray(window.SEASONAL_SPOTS) ? window.SEASONAL_SPOTS : [];
const catalogExclusions = new Set((Array.isArray(window.CATALOG_EXCLUSIONS) ? window.CATALOG_EXCLUSIONS : []).map((entry) => entry.id));
const todayKey = localDateKey();
const currentMonth = new Date().getMonth() + 1;
const activeSeasonalSpots = seasonalSpots.filter((spot) => {
  if (spot.auditStatus === "hold") return false;
  if (spot.availableFrom && todayKey < spot.availableFrom) return false;
  if (spot.availableUntil && todayKey > spot.availableUntil) return false;
  return !spot.activeMonths || spot.activeMonths.includes(currentMonth);
});
const seasonalOverrides = new Map(activeSeasonalSpots.filter((spot) => spot.replacesSpotId).map((spot) => [spot.replacesSpotId, spot]));
const legacyCatalogSpots = [
  ...baseCatalogSpots
    .filter((spot) => !catalogExclusions.has(spot.id) || seasonalOverrides.has(spot.id))
    .map((spot) => seasonalOverrides.has(spot.id) ? { ...spot, ...seasonalOverrides.get(spot.id), id: spot.id } : spot),
  ...activeSeasonalSpots.filter((spot) => !spot.replacesSpotId),
];
const activitySpots = window.ActivityCatalog.build(legacyCatalogSpots, [...(window.ACTIVITY_PLACE_DATA || []), ...(window.ACTIVITY_EXTRA_DATA || []), ...(window.ACTIVITY_SPA_DATA || [])], todayKey);
const activityOverrides = new Map(activitySpots.map((spot) => [spot.id, spot]));
const combinedCatalogSpots = [
  ...legacyCatalogSpots.map((spot) => activityOverrides.has(spot.id) ? { ...spot, ...activityOverrides.get(spot.id) } : spot),
  ...activitySpots.filter((spot) => !legacyCatalogSpots.some((item) => item.id === spot.id)),
].filter((spot, index, spots) => spots.findIndex((item) => item.id === spot.id) === index);
const catalogAuditEntries = [...(window.CATALOG_ACTIVITY_AUDIT_1 || []), ...(window.CATALOG_ACTIVITY_AUDIT_2 || []), ...(window.CATALOG_ACTIVITY_AUDIT_3 || []), ...(window.SEASONAL_ADMISSION_AUDIT || [])];
const catalogSpots = catalogAuditEntries.length ? window.ActivityCatalog.applyAudit(combinedCatalogSpots, catalogAuditEntries) : combinedCatalogSpots;
const recommendableCatalogSpots = [...new Map(catalogSpots
  .filter((spot) => window.ActivityCatalog.isRecommendable(spot) && window.ActivityCatalog.isActive(spot, todayKey))
  .map((spot) => [spot.duplicateOf || spot.id, spot])).values()];
const allSpots = [...catalogSpots, ...dogamSpots.filter((spot) => !catalogSpots.some((item) => item.id === spot.id))];
const interests = {
  all: { label: "아직 모르겠어", pattern: null },
  autumn: { label: "가을 나들이", pattern: /가을|단풍|억새|은행나무|국화|핑크뮬리|갈대|정원|꽃 페스타|꽃축제/i },
  water: { label: "물놀이·스파", pattern: /수영|워터|물놀이|스파|아쿠아|카약|서핑|계곡|SUP/i },
  books: { label: "책·북카페", pattern: /북카페|독립서점|서점|도서관|책방|독서|(?:^|[\s·,])책(?:과|을|으로|\s|$)/i },
  cafe: { label: "카페·디저트", pattern: /카페|커피|디저트|베이커리/i },
  walk: { label: "산책·자연", pattern: /산책|공원|수목원|호수|정원|숲|둘레길|해변/i },
  culture: { label: "전시·구경", pattern: /전시|미술|박물관|갤러리|공연|궁|유적|마을/i },
  activity: { label: "체험·액티비티", pattern: /테마파크|액티비티|체험|클라이밍|놀이공원|놀이기구|레저|보드게임|어드벤처/i },
  running: { label: "러닝하기", pattern: /러닝|달리기|조깅|마라톤|러닝코스/i },
  exhibition: { label: "전시 구경", pattern: /전시|미술관|박물관|갤러리|아트플랫폼|문화전당/i },
  photography: { label: "사진 찍기", pattern: /사진|포토|전망|노을|야경/i },
};
const companionOptions = { any: "상관없어", alone: "혼자", friends: "친구", couple: "연인" };
const matchesInterest = (spot) => state.interest === "all" || (window.ActivityCatalog.interestActivity[state.interest] && spot.activities?.length
  ? spot.activities.includes(window.ActivityCatalog.interestActivity[state.interest])
  : interests[state.interest].pattern.test(`${spot.title} ${spot.desc || ""}`));
const matchesCompanion = (spot) => state.companion === "any" || state.companion === "alone" || !spot.company || spot.company === "both" || spot.company === state.companion;
const activityBrowseSelection = () => window.ActivityCatalog.select((catalogAuditEntries.length ? recommendableCatalogSpots : activitySpots).filter(matchesCompanion), {
  activity: window.ActivityCatalog.interestActivity[state.interest], region: selectedRegion(),
  origin: originCoords(), scope: state.activityScope,
});
const browseCandidates = () => window.ActivityCatalog.interestActivity[state.interest] ? activityBrowseSelection().items : recommendableCatalogSpots
  .filter((spot) => spot.region === selectedRegion() && matchesInterest(spot) && matchesCompanion(spot))
  .map((spot) => ({ ...spot, distanceKm: distanceToSpot(spot) }))
  .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
const spotReason = (spot) => {
  const reasons = [spot.seasonLabel, `${spot.region} 지역`].filter(Boolean);
  if (state.interest !== "all" && matchesInterest(spot)) reasons.push(`${interests[state.interest].label} 관련 장소`);
  if (["friends", "couple"].includes(state.companion) && spot.company && matchesCompanion(spot)) reasons.push(`${companionOptions[state.companion]}와 함께`);
  return reasons.join(" · ");
};
const mapRegionPositions = { 서울: [38, 25], 경기: [43, 28], 인천: [27, 26], 강원: [60, 21], 충북: [50, 40], 충남: [30, 41], 세종: [39, 43], 대전: [41, 47], 전북: [37, 59], 전남: [35, 74], 광주: [28, 68], 경북: [65, 46], 대구: [65, 57], 경남: [55, 65], 울산: [77, 63], 부산: [74, 68], 제주: [67, 89], "내 스팟": [46, 48] };
const normalizedRegion = (label) => label === PILOT_LOCATION ? "서울" : label === "경기도" ? "경기" : (mapRegionPositions[label] ? label : "내 스팟");
const selectedRegion = () => normalizedRegion(state.location.region || state.location.label);
async function refreshWeather() {
  const region = selectedRegion();
  if (region === "내 스팟" || location.protocol === "file:") return;
  state.weather = { region, status: "loading", kind: "" };
  try {
    const response = await fetch(`/api/weather?region=${encodeURIComponent(region)}`);
    const data = await response.json();
    if (selectedRegion() !== region) return;
    state.weather = response.ok && ["rain", "snow", "cloudy", "clear"].includes(data.kind)
      ? { region, status: "ready", kind: data.kind }
      : { region, status: "unavailable", kind: "" };
  } catch {
    if (selectedRegion() !== region) return;
    state.weather = { region, status: "unavailable", kind: "" };
  }
  if (state.screen === "home" || state.screen === "condition") render();
}

const homeWeatherLines = {
  location: [
    "내 위치를 확인하면 지금 날씨에 맞는 장소를 제안할게요.",
    "지역을 선택하면 그곳 날씨에 어울리는 장소를 찾아드릴게요.",
  ],
  unavailable: [
    "오늘 어디를 갈지 고민된다면, 모아가 가볼 만한 곳을 추천해줄게요!",
    "오늘은 어떤 곳이 좋을까요? 가까운 장소부터 살펴봐요.",
  ],
  rain: [
    "비 오는 오늘, 실내에서 여유롭게 보낼 곳을 찾아볼까요?",
    "빗소리가 들리는 날엔 가까운 실내 공간을 찾아봐요.",
    "비가 오는 날, 천천히 둘러볼 곳을 추천해줄게요.",
  ],
  snow: [
    "눈 오는 오늘, 따뜻하게 머물 곳을 찾아볼까요?",
    "눈 내리는 날엔 포근하게 즐길 곳을 찾아봐요.",
  ],
  cloudy: [
    "구름 낀 오늘, 가볍게 다녀올 곳을 찾아볼까요?",
    "흐린 날에도 기분 전환할 곳을 찾아볼까요?",
  ],
  clearDay: [
    "날이 좋은 오늘, 가볍게 다녀올 곳을 찾아볼까요?",
    "햇빛이 반짝이는 날, 걷기 좋은 곳을 찾아볼까요?",
    "맑은 오늘, 잠깐 바람 쐬러 나가볼까요?",
  ],
  clearNight: [
    "맑은 날씨에 어울리는 곳을 찾아볼까요?",
    "오늘은 맑아요. 가까운 곳부터 살펴볼까요?",
  ],
};
const homeWeatherLineThisVisit = new Map();

function homeWeatherLineFor(kind) {
  if (homeWeatherLineThisVisit.has(kind)) return homeWeatherLineThisVisit.get(kind);
  const lines = homeWeatherLines[kind];
  const storageKey = `moa-home-weather-line-${kind}`;
  let previous = -1;
  try { previous = Number(localStorage.getItem(storageKey) ?? -1); } catch { /* 저장이 불가능해도 문구는 보여줘요. */ }
  const index = Number.isInteger(previous) && previous >= -1 && previous < lines.length
    ? (previous + 1) % lines.length : 0;
  const line = lines[index];
  homeWeatherLineThisVisit.set(kind, line);
  try { localStorage.setItem(storageKey, String(index)); } catch { /* 문구 순서 저장이 막혀도 화면은 유지해요. */ }
  return line;
}

function heroWeatherCopy() {
  if (state.location.source === "pilot") return homeWeatherLineFor("location");
  if (state.weather.status !== "ready" || state.weather.region !== selectedRegion()) return homeWeatherLineFor("unavailable");
  if (state.weather.kind !== "clear") return homeWeatherLineFor(state.weather.kind);
  const koreaHour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
  return homeWeatherLineFor(koreaHour >= 6 && koreaHour < 18 ? "clearDay" : "clearNight");
}
const discoveryThemeById = (id) => discoveryThemes.find((theme) => theme.id === id);
const discoveryMatches = (spot, theme) => catalogAuditEntries.length && window.ActivityCatalog.interestActivity[theme.interest]
  ? spot.activities?.includes(window.ActivityCatalog.interestActivity[theme.interest])
  : interests[theme.interest].pattern.test(`${spot.title} ${spot.desc || ""}`);
const discoveryDistance = (spot) => distanceToSpot(spot, state.location.source === "gps" ? state.location.coords : originCoords());
function discoverySpots(theme) {
  const regional = recommendableCatalogSpots.filter((spot) => spot.region === selectedRegion() && (!theme || discoveryMatches(spot, theme)));
  if (state.location.source !== "gps") return regional;
  const nearby = regional.filter((spot) => (discoveryDistance(spot) ?? Infinity) <= 30);
  return nearby.length ? nearby : regional;
}
function discoveryCandidate(theme) {
  if (!theme) return null;
  const spots = discoverySpots(theme);
  if (!spots.length) return null;
  const nearby = spots.map((spot) => ({ spot, distance: discoveryDistance(spot) ?? Infinity }))
    .sort((a, b) => a.distance - b.distance).slice(0, 5);
  return nearby[Number(localDateKey().replaceAll("-", "")) % nearby.length].spot;
}

function todayDiscovery() {
  const today = localDateKey();
  const region = selectedRegion();
  const collected = state.discoveryRecords.find((item) => item.date === today);
  if (collected) return { theme: discoveryThemeById(collected.themeId) || null, collected: true };
  const candidates = discoverySpots(null);
  const available = discoveryThemes.filter((theme) => candidates.some((spot) => discoveryMatches(spot, theme)));
  if (!available.length) return { theme: null, collected: false };
  const seed = Number(today.replaceAll("-", "")) + [...region].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  const regionalTheme = available[seed % available.length];
  return { theme: regionalTheme, collected: false };
}

function discoveryRewardForSpot(spot) {
  const { theme, collected } = todayDiscovery();
  return !collected && theme && spot && spot.region === selectedRegion() && hasCoords(spot) && discoveryMatches(spot, theme) ? theme : null;
}

function awardDiscoveryCard(spot, theme) {
  if (state.discoveryRecords.some((item) => item.date === localDateKey())) return;
  const priorCardCount = state.discoveryRecords.length;
  const record = { date: localDateKey(), themeId: theme.id, region: spot.region, spotId: spot.id, verifiedAt: new Date().toISOString(), verificationType: "gps-photo" };
  state.discoveryRecords = [...state.discoveryRecords, record].sort((a, b) => a.date.localeCompare(b.date)).slice(-365);
  try { localStorage.setItem(DISCOVERY_STORAGE_KEY, JSON.stringify(state.discoveryRecords)); } catch { /* 현재 화면의 인증 상태는 유지해요. */ }
  trackEvent("daily_discovery_collected", { theme_id: theme.id, spot_id: spot.id, total_cards: state.discoveryRecords.length, verification_type: "gps-photo" });
  if (moaLooks.some((look) => look.requiredCards > 0 && priorCardCount < look.requiredCards && state.discoveryRecords.length >= look.requiredCards)) {
    trackEvent("moa_look_unlocked", { total_cards: state.discoveryRecords.length });
  }
}

function visitPhotoReady() {
  return Boolean(state.verify.photo && state.verify.place.trim() && (!state.verify.custom || state.verify.address?.trim()));
}

function visitAddressRegion(address) {
  const first = String(address || "").trim().split(/\s+/)[0];
  const aliases = { "서울특별시": "서울", "서울시": "서울", "경기도": "경기", "강원특별자치도": "강원", "강원도": "강원", "충청북도": "충북", "충청남도": "충남", "전북특별자치도": "전북", "전라북도": "전북", "전라남도": "전남", "경상북도": "경북", "경상남도": "경남", "제주특별자치도": "제주" };
  return aliases[first] || regions.map(normalizedRegion).find((region) => first === region || first === `${region}광역시` || first === `${region}특별자치시`) || "내 스팟";
}

function recordVisitPhoto(options = {}) {
  if (!visitPhotoReady()) return false;
  const record = {
    id: `visit-${Date.now()}`,
    place: state.verify.place.trim(),
    photo: state.verify.photo,
    region: state.verify.custom ? (hasCoords(state.verify.addressCoords) ? state.verify.region : visitAddressRegion(state.verify.address)) : state.verify.region || selectedRegion(),
    spotId: state.verify.spotId || "",
    custom: state.verify.custom,
    description: (state.verify.description || "").trim().slice(0, 100),
    isPublic: state.verify.isPublic === true,
    address: state.verify.custom ? state.verify.address.trim() : "",
    addressCoords: state.verify.custom && hasCoords(state.verify.addressCoords) ? { ...state.verify.addressCoords } : null,
    createdAt: new Date().toISOString(),
  };
  if (options.draftOnly) return record;
  state.explorations.unshift(record);
  state.verify.open = false;
  return record;
}

async function persistVisitPhoto() {
  if (!visitPhotoReady() || state.verify.checking) return false;
  const draft = state.verify;
  const record = recordVisitPhoto({ draftOnly: true });
  trackEvent("visit_record_submitted", { place_type: draft.custom ? "custom" : "catalog", visibility: draft.isPublic ? "public" : "private" });
  draft.checking = true;
  draft.error = "";
  render();
  try {
    if (!window.MoaData) throw new Error("사진 저장 서비스에 연결하지 못했어요.");
    const saved = await window.MoaData.addVisit(record);
    state.explorations.unshift(saved);
    if (saved.isPublic) state.publicVisits.unshift(saved);
    if (state.verify === draft) draft.open = false;
    state.dataError = "";
    trackEvent("visit_record_completed", { place_type: draft.custom ? "custom" : "catalog", visibility: saved.isPublic ? "public" : "private", has_reflection: Boolean(draft.description?.trim()) });
    return true;
  } catch {
    trackEvent("visit_record_failed", { failure_reason: "persistence_failed" });
    if (state.verify === draft) draft.error = "사진을 저장하지 못했어요. 연결을 확인하고 다시 시도해 주세요.";
    return false;
  } finally {
    draft.checking = false;
    render();
  }
}

function preferenceSnapshot() {
  return { saved_spots: [...state.savedSpotIds], saved_moments: [...state.savedMomentIds], discovery_records: structuredClone(state.discoveryRecords), moa_look: state.moaLook };
}

async function persistPreferences() {
  if (!window.MoaData) throw new Error("저장 서비스에 연결하지 못했어요.");
  await window.MoaData.savePreferences(preferenceSnapshot());
}

async function refreshCloudData() {
  if (!window.MoaData) { state.dataLoading = false; state.dataError = "저장 서비스에 연결하지 못했어요. 다시 열어 주세요."; return; }
  try {
    const data = await window.MoaData.restore();
    if (!RECORDED_HOME_PREVIEW) state.explorations = data.visits;
    state.publicVisits = data.publicVisits;
    state.likeTotals = data.totals;
    state.likedMomentIds = data.liked;
    if (data.preferences) {
      state.savedSpotIds = data.preferences.saved_spots;
      state.savedMomentIds = data.preferences.saved_moments;
      state.moaLook = data.preferences.moa_look;
      state.discoveryRecords = data.preferences.discovery_records;
    }
    state.dataError = "";
  } catch (error) { state.dataError = error.code === "MOA_IDENTITY" ? error.message : "기록을 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요."; }
  state.dataLoading = false;
  if (!state.verify.open && !state.regionOpen) render();
}

function momentLikeCount(moment) {
  return state.likeTotals[moment.id] ?? (window.__MOA_RELEASE__ ? 0 : moment.likes + (state.likedMomentIds.includes(moment.id) ? 1 : 0));
}

function moaLookUnlocked(look) {
  return state.discoveryRecords.length >= look.requiredCards;
}

function activeMoaLook() {
  const selected = moaLooks.find((look) => look.id === state.moaLook);
  return selected && moaLookUnlocked(selected) ? selected : moaLooks[0];
}

const originCoords = () => state.location.label === PILOT_LOCATION ? PILOT_COORDS : (state.location.source === "selected" || (state.location.source === "gps" && state.location.accuracy <= 500) ? state.location.coords : null);
const hasCoords = (point) => point && Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;
function distanceToSpot(spot, origin = originCoords()) {
  if (!hasCoords(origin) || !hasCoords(spot)) return null;
  const toRadians = (value) => value * Math.PI / 180;
  const latitudeDelta = toRadians(spot.lat - origin.lat);
  const longitudeDelta = toRadians(spot.lng - origin.lng);
  const a = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(toRadians(origin.lat)) * Math.cos(toRadians(spot.lat)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(Math.min(1, a)), Math.sqrt(Math.max(0, 1 - a)));
}
const distanceLabel = (km) => {
  if (km < 0.1) return "100m 미만";
  const rounded = Math.round(km * 10) / 10;
  return rounded < 1 ? `${Math.round(rounded * 1000)}m` : `${rounded.toFixed(1)}km`;
};
const kakaoRouteMode = { walk: "walk", transit: "traffic", car: "car" };
function routeUrl(spot) {
  if (!hasCoords(spot)) return `https://map.kakao.com/link/search/${encodeURIComponent(spot.searchQuery || spot.title)}`;
  const destination = `${encodeURIComponent(spot.title)},${spot.lat},${spot.lng}`;
  const origin = originCoords();
  if (!hasCoords(origin)) return `https://map.kakao.com/link/to/${destination}`;
  const departureName = state.location.source === "gps" ? "현재 위치" : state.location.label;
  const departure = `${encodeURIComponent(departureName)},${origin.lat},${origin.lng}`;
  return `https://map.kakao.com/link/by/${kakaoRouteMode[state.transport]}/${departure}/${destination}`;
}
function mapProviderUrl(spot, provider) {
  const query = spot.searchQuery || [spot.region, spot.area, spot.title].filter(Boolean).join(" ");
  if (provider === "naver") return `https://map.naver.com/p/search/${encodeURIComponent(query)}`;
  if (provider === "google") return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(hasCoords(spot) ? `${spot.lat},${spot.lng}` : query)}`;
  return hasCoords(spot) ? `https://map.kakao.com/link/to/${encodeURIComponent(spot.title)},${spot.lat},${spot.lng}` : `https://map.kakao.com/link/search/${encodeURIComponent(query)}`;
}
function mapPickerSheet() {
  const spot = allSpots.find(item => item.id === state.mapPickerSpotId);
  if (!spot) return "";
  return `<div class="sheet-backdrop map-picker-backdrop"><section class="map-picker" role="dialog" aria-modal="true" aria-labelledby="map-picker-title"><div class="sheet-handle"></div><h2 id="map-picker-title">어떤 지도로 볼까요?</h2><p>${escapeHtml(spot.title)}<br>출발지와 이동 수단은 지도에서 선택해 주세요.</p><div class="map-picker__options">${[["naver", "네이버지도", "장소 검색 후 길찾기"], ["kakao", "카카오맵", "목적지로 길찾기"], ["google", "Google 지도", "목적지로 길찾기"]].map(([key, label, hint]) => `<a href="${escapeHtml(mapProviderUrl(spot, key))}" target="_blank" rel="noopener noreferrer" data-map-provider="${key}"><span>${label}<small>${hint}</small></span><span aria-hidden="true">↗</span></a>`).join("")}</div><button type="button" data-copy-map-place>장소 정보 복사</button><p class="map-picker__status" role="status"></p><button type="button" data-close-map-picker>닫기</button></section></div>`;
}
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
function saveLocation(location) {
  if (state.regionOpen && state.screen === "condition") trackEvent("recommendation_step_completed", { step: "region", screen: state.screen });
  state.location = location;
  if (state.pendingHomeDestination) {
    state.screen = state.pendingHomeDestination;
    state.pendingHomeDestination = "";
  }
  state.homeLocationGateDismissed = true;
  try { sessionStorage.setItem(HOME_LOCATION_GATE_DISMISSED_KEY, "1"); } catch { /* 세션 저장이 막혀도 현재 화면에서는 유지해요. */ }
  state.discoveryManualReady = location.source === "manual" || location.source === "selected";
  state.discoveryLocationError = "";
  try {
    localStorage.setItem(LOCATION_STORAGE_KEY, location.label);
    localStorage.setItem(LOCATION_REGION_STORAGE_KEY, location.region);
    if (location.source === "selected" && hasCoords(location.coords)) localStorage.setItem(LOCATION_COORDS_STORAGE_KEY, JSON.stringify(location.coords));
    else localStorage.removeItem(LOCATION_COORDS_STORAGE_KEY);
  } catch { /* 파일 미리보기에서는 저장이 제한될 수 있어요. */ }
  refreshWeather();
}

const regions = ["경기도", "서울", "인천", "부산", "대구", "대전", "광주", "울산", "세종", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"];

const regionSelect = () => `<button type="button" class="region-select" data-action="open-region" aria-label="${state.location.source === "pilot" ? "출발 위치 설정" : `출발 기준 변경: ${escapeHtml(state.location.label)}`}">⌖ <strong>${state.location.source === "pilot" ? "위치 설정" : escapeHtml(state.location.label)}</strong><svg class="region-chevron" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4.5 6 3.5 3.5L11.5 6"/></svg></button>`;

function regionSheet() {
  const lookup = state.originLookup;
  const isLocalServer = location.protocol === "http:" || location.protocol === "https:";
  const options = lookup.results.map((item, index) => `<button type="button" class="origin-result" data-origin-result="${index}"><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.address)}</small><span>${escapeHtml(item.region)} · 이 위치로 출발 ›</span></button>`).join("");
  return `<div class="sheet-backdrop region-backdrop" data-action="close-region"><section class="region-sheet" role="dialog" aria-modal="true" aria-labelledby="region-title">
    <div class="sheet-handle"></div><p class="eyebrow">출발 지역</p><h2 id="region-title">어디에서 출발하나요?</h2>
    <p>주소나 역·건물 이름을 검색하거나, 먼저 지역만 선택해도 돼요.</p>
    <form id="origin-form" class="origin-form">
      <label for="origin-input">출발지 직접 입력</label>
      <input id="origin-input" name="origin" type="text" maxlength="80" required autocomplete="off" placeholder="예: 서울역, 부산역" value="${escapeHtml(lookup.query || (state.location.label === PILOT_LOCATION || regions.includes(state.location.label) ? "" : state.location.label))}">
      <button type="submit" ${lookup.status === "loading" ? "disabled" : ""}>${lookup.status === "loading" ? "찾는 중…" : isLocalServer ? "카카오에서 출발지 찾기" : "지역 기준으로 설정"}</button>
      ${lookup.message ? `<p class="origin-feedback" role="status" ${lookup.status === "error" ? `data-analytics-error="origin_search_failed"` : lookup.status === "ready" && !lookup.results.length ? `data-analytics-empty="origin_search"` : ""}>${escapeHtml(lookup.message)}</p>` : ""}
      ${options ? `<div class="origin-results" aria-label="출발지 검색 결과">${options}</div>` : ""}
      <label for="origin-region">${isLocalServer ? "검색이 안 될 때 지역만 선택" : "어느 지역인가요?"}</label>
      <select id="origin-region" name="region">${state.location.source === "pilot" ? `<option value="" disabled selected>지역을 선택해 주세요</option>` : ""}${regions.map((region) => `<option value="${region}" ${state.location.source !== "pilot" && selectedRegion() === normalizedRegion(region) ? "selected" : ""}>${region}</option>`).join("")}</select>
      <button type="button" class="origin-region-only" data-action="save-region-only">이 지역으로 설정하기</button>
      ${isLocalServer ? `<button type="button" class="origin-manual-fallback" data-action="save-manual-origin">입력한 출발지와 지역으로 설정하기</button>` : ""}
      <small>검색 결과를 선택하면 그 좌표로 직선거리를 계산해요. 실제 이동거리·시간은 카카오맵에서 확인해 주세요.</small>
    </form>
    <button type="button" class="detect-location-button" data-action="request-location">현재 위치로 지역 추정하기</button>
    <button class="sheet-close" data-action="close-region">닫기</button>
  </section></div>`;
}

const transportData = {
  walk: { label: "도보", icon: "walk" },
  transit: { label: "대중교통", icon: "transit" },
  car: { label: "자동차", icon: "car" },
};

const icons = {
  walk: '<circle cx="13" cy="4" r="2"/><path d="m10 21 2-6-3-3 2-4 3 3 3 1M12 15l4 5"/>',
  transit: '<rect x="6" y="3" width="12" height="16" rx="3"/><path d="M8 8h8M8.5 15h.01M15.5 15h.01M8 19l-1.5 2M16 19l1.5 2"/>',
  car: '<path d="m5 11 1.5-4h11l1.5 4"/><path d="M4 11h16v6H4zM6.5 17v2M17.5 17v2"/><circle cx="7.5" cy="14" r=".7" fill="currentColor"/><circle cx="16.5" cy="14" r=".7" fill="currentColor"/>',
  home: '<path d="m4 10 8-6 8 6M6.5 9v10h11V9"/>',
  bookmark: '<path d="M6.5 4.8c0-1 .8-1.8 1.8-1.8h7.4c1 0 1.8.8 1.8 1.8V21L12 17.6 6.5 21V4.8Z"/>',
  user: '<circle cx="12" cy="8" r="3"/><path d="M6 20c.6-4 2.6-6 6-6s5.4 2 6 6"/>',
  friends: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.3"/><path d="M3.5 20c.5-4 2.3-6 5.5-6s5 2 5.5 6M14 15c2.8-.5 5.2 1.2 6 4"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>',
  check: '<path d="m5 12.5 4.2 4L19 7"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>',
  sparkle: '<path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2ZM19 17l.6 1.4L21 19l-1.4.6L19 21l-.6-1.4L17 19l1.4-.6L19 17Z"/>',
  plusCircle: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v9M7.5 12h9"/>',
};

const icon = (name, size = 24) => `<svg class="ui-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;

const mascot = (pose, size = "medium", alt = "탐험 메이트 모아") =>
  `<div class="moa moa--${size}"><img src="${size === "hero" ? activeMoaLook().image : `assets/moa-${pose}-v1.png`}" alt="${alt}"></div>`;

const crowdDataCache = new Map();
function findCrowdData(spotId) {
  const cached = crowdDataCache.get(spotId);
  if (!cached || Date.now() - cached.requestedAt >= 60_000) {
    crowdDataCache.set(spotId, { requestedAt: Date.now(), promise: fetch(`/api/crowd?spotId=${encodeURIComponent(spotId)}`)
      .then((response) => response.ok ? response.json() : null)
      .catch(() => null) });
  }
  return crowdDataCache.get(spotId).promise;
}

const crowdTimeLabel = (isoTime) => {
  const date = new Date(isoTime);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
};

function placeCrowdContent(node, label, value, context, source) {
  const heading = document.createElement("p");
  heading.className = "place-detail__crowd-heading";
  const name = document.createElement("span");
  name.textContent = label;
  const status = document.createElement("strong");
  status.textContent = value;
  heading.append(name, status);
  const description = document.createElement("p");
  description.className = "place-detail__crowd-context";
  description.textContent = context;
  const note = document.createElement("p");
  note.className = "place-detail__crowd-source";
  note.textContent = source;
  node.replaceChildren(heading, description, note);
}

async function hydrateCrowdContext(node) {
  const spot = allSpots.find((item) => item.id === node.dataset.crowdSpot);
  if (!spot) return;
  const live = crowdAreaBySpotId[spot.id] && location.protocol !== "file:" ? await findCrowdData(spot.id) : null;
  if (!node.isConnected) return;
  if (live) {
    const time = crowdTimeLabel(live.observedAt);
    const label = window.CROWD_FORECAST.populationLabel(live.level);
    const delayed = live.freshness === "delayed";
    node.classList.add(`crowd-level-${live.level.replace(/\s/g, "-")}`);
    if (node.closest(".place-detail-screen")) {
      placeCrowdContent(node, "주변 인구 혼잡도", label,
        `${live.area} 일대 · 장소 내부 혼잡도는 아니에요.`,
        `${time ? `${time} 기준 · ` : ""}${delayed ? "갱신 지연 · " : ""}출처: 서울시`);
    } else if (node.dataset.crowdDetail === "true") {
      const title = document.createElement("strong");
      title.textContent = `주변 인구 혼잡도 · ${label}`;
      const description = document.createElement("span");
      description.textContent = `${live.area} 일대의 인구 혼잡도예요. 장소 내부의 혼잡도는 아니에요.${delayed ? " 데이터 갱신이 지연되고 있어요." : ""}`;
      const note = document.createElement("small");
      note.textContent = `${time} 기준${delayed ? " · 갱신 지연" : ""} · 출처: 서울특별시 · 추천 순위에는 반영하지 않아요`;
      node.replaceChildren(title, description, note);
    } else {
      node.textContent = `주변 인구 혼잡도 · ${label} · ${live.area}${time ? ` · ${time} 기준` : ""}${delayed ? " · 갱신 지연" : ""} · 서울시`;
    }
    node.hidden = false;
    return;
  }

  const forecast = window.CROWD_FORECAST?.estimate(spot);
  if (!forecast) return;
  node.classList.add("crowd-context--forecast");
  if (node.closest(".place-detail-screen")) {
    placeCrowdContent(node, "예상 혼잡도", forecast.level.replace(/ 예상$/, ""),
      `${forecast.reasons.join(" · ")} 기반 예상 · 실시간 측정값은 아니에요.`,
      `근거: ${forecast.basis}`);
  } else if (node.dataset.crowdDetail === "true") {
    const title = document.createElement("strong");
    title.textContent = `예상 혼잡도 · ${forecast.level.replace(/ 예상$/, "")}`;
    const description = document.createElement("span");
    description.textContent = `${forecast.reasons.join(" · ")}을 바탕으로 한 예상이에요. 실시간 인원 측정값은 아니에요.`;
    const note = document.createElement("small");
    note.textContent = `근거: ${forecast.basis} · 추천 순위에는 반영하지 않아요`;
    node.replaceChildren(title, description, note);
  } else {
    const heading = document.createElement("div");
    heading.className = "crowd-forecast__heading";
    const label = document.createElement("span");
    label.textContent = "예상 혼잡도";
    const status = document.createElement("strong");
    status.textContent = forecast.level.replace(/ 예상$/, "");
    status.dataset.crowdTone = forecast.level === "비교적 여유 예상" ? "calm" : "busy";
    heading.append(label, status);
    const reason = document.createElement("p");
    reason.className = "crowd-forecast__reason";
    reason.textContent = `예측 근거: ${forecast.reasons.join(" · ")}`;
    const note = document.createElement("p");
    note.className = "crowd-forecast__note";
    note.textContent = "실시간 측정값은 아니에요.";
    node.replaceChildren(heading, reason, note);
  }
  node.hidden = false;
}

function observeCrowdContexts() {
  document.querySelectorAll("[data-crowd-spot]").forEach(hydrateCrowdContext);
}

const crowdContext = (spot, detail = false) =>
  `<aside class="crowd-context ${detail ? "crowd-context--detail" : ""}" data-crowd-spot="${escapeHtml(spot.id)}" data-crowd-detail="${detail}" hidden></aside>`;

const transportSelector = (compact = false) => `
  <div class="transport ${compact ? "transport--compact" : ""}" role="group" aria-label="이동수단">
    ${Object.entries(transportData).map(([key, item]) => `
      <button type="button" data-transport="${key}" aria-pressed="${state.transport === key}" class="${state.transport === key ? "is-selected" : ""}">
        ${icon(item.icon, compact ? 21 : 26)}<b>${item.label}</b>
      </button>`).join("")}
  </div>`;

const primaryButton = (label, action, icon = "✦") =>
  `<button type="button" class="primary-button" data-action="${action}"><span aria-hidden="true">${icon}</span>${label}</button>`;

const bottomNav = (active) => `
  <nav class="bottom-nav" aria-label="하단 메뉴">
    <button type="button" data-tab="home" class="${active === "home" ? "is-active" : ""}" ${active === "home" ? 'aria-current="page"' : ""}><span class="nav-icon"><img src="assets/nav-home.png" alt="" aria-hidden="true"></span><span>홈</span></button>
    <button type="button" data-tab="moments" class="${active === "moments" ? "is-active" : ""}" ${active === "moments" ? 'aria-current="page"' : ""}><span class="nav-icon"><img src="assets/nav-moments.png" alt="" aria-hidden="true"></span><span>모아진 순간</span></button>
    <button type="button" data-action="open-verify" class="verify-nav-button"><span class="nav-icon"><img src="assets/nav-verify.png" alt="" aria-hidden="true"></span><span>인증</span></button>
    <button type="button" data-tab="saved" class="${active === "saved" ? "is-active" : ""}" ${active === "saved" ? 'aria-current="page"' : ""}><span class="nav-icon"><img src="assets/nav-saved.png" alt="" aria-hidden="true"></span><span>저장</span></button>
    <button type="button" data-tab="my" class="${active === "my" ? "is-active" : ""}" ${active === "my" ? 'aria-current="page"' : ""}><span class="nav-icon"><img src="assets/nav-my.png" alt="" aria-hidden="true"></span><span>마이</span></button>
  </nav>`;


const header = (title, back, share = false) => `
  <header class="app-header">
    <div></div>
    <strong>${title}</strong>
    <div>${share ? `<button class="icon-button" data-action="open-share" aria-label="친구에게 공유">↗</button>` : ""}</div>
  </header>`;

function recentExploration(items = state.explorations) {
  if (!state.explorations.length) {
    return `<button type="button" class="exploration-empty" data-action="open-verify"><div class="photo-placeholder">＋</div><div><strong>첫 탐험을 인증해보세요</strong><span>다녀온 장소를 선택하고 사진으로 남겨요.</span><em>인증 시작 ›</em></div></button>`;
  }
  return `<div class="my-visit-list">${items.map((item) => {
    const date = new Date(item.createdAt);
    const dateLabel = Number.isNaN(date.getTime()) ? "방문 기록" : new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
    return `<article class="my-visit-card">
      <header class="my-visit-card__meta"><span>${escapeHtml(dateLabel)}</span><span class="my-visit-card__visibility">${item.isPublic ? "공개한 순간" : "나만의 순간"}</span></header>
      <img class="my-visit-card__photo" src="${escapeHtml(item.photo)}" alt="${escapeHtml(item.place)}에서 남긴 사진" loading="lazy">
      <div class="my-visit-card__copy"><p class="my-visit-card__region">${escapeHtml(item.address || item.region)}</p><h3>${escapeHtml(item.place)}</h3>${item.description ? `<p class="my-visit-card__note">${escapeHtml(item.description)}</p>` : ""}<p class="my-visit-card__stamp">✓ 다녀온 순간을 남겼어요</p></div>
      ${!item.id.startsWith("preview-") ? `<footer class="my-visit-card__actions"><button type="button" data-visit-public="${escapeHtml(item.id)}">${item.isPublic ? "공개 취소" : "모아진 순간에 공개하기"}</button><button type="button" data-visit-delete="${escapeHtml(item.id)}">삭제</button></footer>` : `<p class="my-visit-card__sample">미리보기용 기록이에요</p>`}
    </article>`;
  }).join("")}</div>`;
}

function dailyDiscoveryCard() {
  const locating = state.location.source === "loading";
  const ready = state.location.source === "gps" || state.discoveryManualReady;
  const discovery = todayDiscovery();
  const collected = discovery.collected;
  const collectedRecord = collected ? state.discoveryRecords.find((item) => item.date === localDateKey()) : null;
  const theme = collected && !ready ? discoveryThemeById(collectedRecord?.themeId) || discovery.theme : discovery.theme;
  const savedCandidate = collectedRecord?.spotId
    ? catalogSpots.find((spot) => spot.id === collectedRecord.spotId) : null;
  const candidate = ready ? savedCandidate || discoveryCandidate(theme) : null;
  const candidateDistance = candidate ? discoveryDistance(candidate) : null;
  const nearbyCandidate = candidateDistance !== null && candidateDistance <= 30;
  const title = locating ? "가까운 장소를 찾는 중" : !ready && collected && theme ? theme.title : !ready ? "오늘은 어디를 발견할까?" : !theme ? "다른 지역을 살펴볼까요?" : theme.title;
  const description = locating ? "지금 위치에 어울리는 장소를 고르고 있어요." : !ready && collected ? "현장에서 인증해 받은 카드예요. 현재 위치를 찾으면 장소를 볼 수 있어요." : !ready ? "지역을 확인하고 오늘 가볼 곳을 미리 살펴봐요." : !theme ? "이 지역에 연결할 장소가 아직 없어요." : collected ? `현장에서 인증한 ${collectedRecord?.region || selectedRegion()}의 발견 카드예요.` : "추천 장소를 살펴보고, 도착하면 위치와 사진으로 인증해요.";
  const cardAction = !ready ? `data-action="find-discovery-nearby"` : !theme ? `data-action="open-region"` : candidate ? `data-action="open-discovery-candidate"` : `data-discovery-theme="${theme.id}"`;
  const cardActionLabel = locating ? "위치 확인 중…" : !ready ? "현재 위치로 찾기" : !theme ? "다른 지역 선택하기" : collected ? "인증한 장소 다시 보기" : "추천 장소 보기";
  return `<section class="daily-discovery" aria-labelledby="daily-discovery-title">
    <div class="daily-discovery-heading"><div><span>내 위치에 맞춰 가볼 곳</span><h2 id="daily-discovery-title">오늘의 발견</h2></div><span class="daily-discovery-week">인증 카드 ${state.discoveryRecords.length}장</span></div>
    <article class="discovery-compact" aria-label="${escapeHtml(title)}">
      <div class="discovery-compact-main"><div class="discovery-compact-copy"><span class="discovery-compact-kicker">${collected ? "현장 인증 완료" : ready ? `${escapeHtml(selectedRegion())} · 방문 전 미리보기` : "내 주변의 새로운 장소"}</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p></div><img src="${activeMoaLook().image}" alt="" aria-hidden="true"></div>
      ${candidate ? `<div class="discovery-compact-place"><span>${state.location.source === "gps" && nearbyCandidate ? "지금 위치 주변" : "추천 장소"}</span><strong>${escapeHtml(candidate.title)}</strong><small>${escapeHtml(candidate.region)} · ${escapeHtml(candidate.area || "장소")}${candidateDistance === null ? "" : ` · 직선 약 ${distanceLabel(candidateDistance)}`}</small></div>` : ""}
      <button type="button" class="discovery-compact-action" ${cardAction} ${locating ? "disabled" : ""}>${cardActionLabel}<span aria-hidden="true">›</span></button>
    </article>
    ${state.discoveryLocationError && !ready ? `<p class="daily-discovery-error" role="status">${escapeHtml(state.discoveryLocationError)}</p>` : ""}
    ${!ready
      ? `<button type="button" class="daily-discovery-manual" data-action="open-region"><span class="daily-discovery-manual-icon" aria-hidden="true">⌖</span><span class="daily-discovery-manual-copy"><strong>지역 직접 선택</strong><small>위치 권한 없이 원하는 지역으로 둘러봐요</small></span><span class="daily-discovery-manual-arrow" aria-hidden="true">›</span></button><small class="daily-discovery-privacy">현재 위치는 장소 추천에만 쓰고 저장하지 않아요.</small>`
      : `<div class="daily-discovery-region"><span>${state.location.source === "gps" ? "현재 위치" : "선택 지역"} · <strong>${escapeHtml(selectedRegion())}</strong></span><button type="button" data-action="open-region">지역 변경 <span aria-hidden="true">›</span></button></div>`}
  </section>`;
}

function discoveryChallengeCard() {
  const count = HOME_CARD_COUNT_PREVIEW ?? state.discoveryRecords.length;
  const milestoneCount = Math.min(count, 3);
  const progressTarget = count < 3 ? 3 : 20;
  const progressCount = Math.min(count, progressTarget);
  const rewardStage = count >= 20 ? 20 : count >= 10 ? 10 : count >= 3 ? 3 : 0;
  const milestoneImage = rewardStage
    ? `assets/moa_card_img_${rewardStage === 3 ? 4 : rewardStage === 10 ? 5 : 6}.png`
    : `assets/home_card0${milestoneCount}.png`;
  const nextReward = count < 3
    ? { name: "사진꽃 모아", remaining: 3 - count }
    : count < 10
      ? { name: "폴라로이드 모아", remaining: 10 - count }
      : count < 20
        ? { name: "카드 라이더 모아", remaining: 20 - count }
        : null;
  const rewardMessage = nextReward
    ? `${nextReward.name}까지 <strong>${nextReward.remaining}장</strong> 남았어요`
    : "모든 모아를 만났어요!";
  return `<section class="home-editorial-collection" aria-labelledby="home-editorial-collection-title">
    <small class="home-editorial-collection__eyebrow">나의 발견</small>
    <button type="button" class="home-editorial-collection__card" data-action="open-moa-looks" aria-label="모아 꾸미기, 현장 인증 카드 ${progressCount}/${progressTarget}장">
      <span class="home-editorial-collection__main"><span class="home-editorial-collection__heading-copy"><strong id="home-editorial-collection-title">모아 꾸미기</strong><span class="home-editorial-collection__summary">현장 인증 카드 <em>${progressCount} / ${progressTarget}장</em></span></span><span class="home-editorial-collection__link">보상 미리보기 <span aria-hidden="true">→</span></span></span>
      <span class="home-editorial-collection__journey${rewardStage ? " is-reward-roadmap" : ""}" aria-hidden="true"><img class="home-editorial-collection__progress-art" src="${milestoneImage}" alt=""></span>
      <span class="home-editorial-collection__footer"><span class="home-editorial-collection__count">${rewardMessage}</span></span>
    </button>
  </section>`;
}

function homeMomentEntry() {
  const latestMoment = state.explorations[0] || null;
  const registeredSpot = latestMoment?.spotId ? allSpots.find((spot) => spot.id === latestMoment.spotId) : null;
  const placeName = registeredSpot?.title || latestMoment?.place?.trim() || "이름 없는 장소";
  const recordedDate = latestMoment?.createdAt
    ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric" }).format(new Date(latestMoment.createdAt))
    : "최근 기록";
  const hasMoment = Boolean(latestMoment?.photo);
  return `<section class="home-editorial-moment-entry" aria-label="나의 순간">
    <button type="button" class="home-editorial-moment-entry__button${hasMoment ? " is-recorded" : ""}" ${hasMoment ? 'data-screen="my"' : 'data-action="open-verify"'}>
      <small class="home-editorial-moment-entry__eyebrow">나의 기록</small>
      <span class="home-editorial-moment-entry__main"><span class="home-editorial-moment-entry__copy"><strong>${hasMoment ? "오늘의 순간을 남겼어요" : "첫 번째 순간을 기다리고 있어요"}</strong><span>${hasMoment ? `<b class="home-editorial-moment-entry__place">${escapeHtml(placeName)}</b><small class="home-editorial-moment-entry__date">${escapeHtml(recordedDate)}</small>` : "다녀온 곳의 사진을 남겨보세요. 누군가의 다음 장소 선택에 도움이 돼요."}</span><span class="home-editorial-moment-entry__link">${hasMoment ? "나의 기록 보기" : "첫 순간 기록하기"} <span aria-hidden="true">→</span></span></span>${hasMoment ? `<span class="home-editorial-moment-entry__visual home-editorial-moment-entry__visual--photo"><svg class="home-editorial-moment-entry__cloud" viewBox="0 0 220 130" aria-hidden="true"><path d="M22 82C8 65 18 45 38 42C43 19 70 13 86 29C101 5 137 8 146 34C167 22 193 38 190 62C210 72 205 102 181 107C163 122 139 113 126 104C108 124 79 119 68 105C44 119 17 105 22 82Z" /></svg><svg class="home-editorial-moment-entry__doodle" viewBox="0 0 42 42" aria-hidden="true"><path d="M21 3C20 14 15 20 5 21C15 23 20 28 21 39C23 28 28 23 38 21C28 20 23 14 21 3Z"/></svg><span class="home-editorial-moment-entry__polaroid"><img class="home-editorial-moment-entry__photo" src="${escapeHtml(latestMoment.photo)}" alt="${escapeHtml(placeName)}에서 남긴 최근 기록"><small aria-hidden="true">01</small></span></span>` : `<span class="home-editorial-moment-entry__visual" aria-hidden="true"><img class="home-editorial-moment-entry__illustration" src="assets/img_illust" alt=""></span>`}</span>
    </button>
  </section>`;
}

function moaLookSheet() {
  const look = moaLooks.find((item) => item.level === state.moaLookLevel) || moaLooks[0];
  const unlocked = moaLookUnlocked(look);
  const applied = activeMoaLook().id === look.id;
  const cardCount = state.discoveryRecords.length;
  return `<div class="sheet-backdrop moa-look-backdrop" data-action="close-moa-looks"><section class="moa-look-sheet" role="dialog" aria-modal="true" aria-labelledby="moa-look-title">
    <div class="moa-look-header"><div><span>모아 컬렉션</span><h2 id="moa-look-title">모아 꾸미기</h2></div><button type="button" data-action="close-moa-looks" aria-label="모아 꾸미기 닫기">×</button></div>
    <p class="moa-look-intro">탐험 모아는 처음부터 함께해요. 현장 인증 카드를 3·10·20장 모으면 새로운 모아가 열려요.</p>
    <div class="moa-look-rail">${moaLooks.map((item) => {
      const itemUnlocked = moaLookUnlocked(item);
      return `<button type="button" class="moa-look-card ${item.level === look.level ? "is-focused" : ""} ${itemUnlocked ? "is-unlocked" : "is-locked"}" data-look-level="${item.level}" aria-label="Level ${item.level} ${item.title}, ${itemUnlocked ? "획득함" : "잠김"}">
        <svg class="moa-look-card__sketch" viewBox="0 0 232 284" preserveAspectRatio="none" aria-hidden="true"><path d="M14 3.8C57 2.1 95 4.7 137 3.1S190 4.9 218 3.5C225 3.5 229.1 8.6 228.5 16.3 229.2 77.4 227.2 137.8 228.7 198.1L228.3 268.7C228.4 276.4 224.2 280.7 217.5 280.5 177.4 281.8 138.2 279.5 97.1 281S49.4 279.2 13.5 280.6C6.5 280.4 2.8 275.7 3.2 268.2 2.1 184.6 4.2 98.8 2.9 16 3.1 8.2 7.1 3.5 14 3.8Z"/><path class="moa-look-card__sketch-echo" d="M15.2 5.2C63.5 4 107.2 5.8 151.5 4.5S195.6 6 216.9 5.1C223 5.2 226.9 9.7 226.5 17 227.2 87.5 225.4 157.8 226.7 267.6 226.6 274 223.1 277.8 216.7 278.1 171 279.2 125.9 277.3 80.7 278.6S46.8 277.1 14.6 278.2C8.5 278.1 5.1 274 5.4 267.3 4.5 181.6 6.1 96.7 4.9 16.8 5.1 9.8 8.8 4.9 15.2 5.2Z"/></svg>
        <span class="moa-look-level-label">LEVEL ${item.level}<em>${item.requiredCards ? `${item.requiredCards} CARDS` : "STARTER"}</em></span>
        <span class="moa-look-art"><img src="${item.image}" alt="" loading="lazy"><i aria-hidden="true">${itemUnlocked ? activeMoaLook().id === item.id ? "✓" : "○" : "⌑"}</i></span>
        <strong>${itemUnlocked ? item.title : "잠긴 모아"}</strong><small>${item.description}</small>
      </button>`;
    }).join("")}</div>
    <p class="moa-look-status" role="status">${unlocked ? applied ? "지금 홈에서 만나고 있는 모아예요." : "획득한 모습이에요. 적용하면 홈의 모아가 바뀌어요." : `현장 인증 카드 ${cardCount}/${look.requiredCards}장 · ${look.requiredCards - cardCount}장 더 모으면 열려요.`}</p>
    <button type="button" class="moa-look-apply" data-action="apply-moa-look" ${!unlocked ? "disabled" : ""}>${applied ? "이 모습으로 계속하기" : unlocked ? "이 모습 적용하기" : "아직 잠겨 있어요"}</button>
    <small class="moa-look-note">이 꾸미기 기록은 현재 브라우저에만 저장돼요. 현금·쿠폰 보상은 아니에요.</small>
  </section></div>`;
}

const locationReadyForHome = () => state.location.source === "gps" || state.location.source === "manual" || state.location.source === "selected";

function homeSketchFrame(kind) {
  if (kind === "search") {
    return `<svg class="home-editorial__sketch-frame home-editorial__sketch-frame--search" viewBox="0 0 350 54" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="home-search-pencil" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#71947f"/><stop offset=".72" stop-color="#86ab97"/><stop offset="1" stop-color="#a5cec1"/></linearGradient><filter id="home-search-rough" x="-3%" y="-16%" width="106%" height="132%"><feTurbulence type="fractalNoise" baseFrequency=".018 .22" numOctaves="2" seed="7" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale=".55" xChannelSelector="R" yChannelSelector="G"/></filter></defs><g filter="url(#home-search-rough)"><path d="M14 3C73 1 122 4 178 2.2S282 4 336 2.4C344 2.3 348 8.2 347.4 15.4L347.7 39.5C347.4 47.2 343 51 335.2 51.3 278 53 221 50.2 163 51.8S65 50 14 51.6C6.1 51.6 2.2 47 2.7 39.7L2 15.1C2.2 7.1 6.1 2.5 14 3Z"/><path class="home-editorial__sketch-echo" d="M15 4C82 3 145 4.5 211 3.4S299 4.4 335 3.8C342.1 3.7 346.1 8.4 345.8 15.8L346.1 39C345.9 45.9 342.1 49.7 334.8 50 270 51.2 205 49.4 140 50.4S60 49.3 15.2 50C8.2 49.9 4.1 46 4.4 39.2L3.8 15.8C3.9 8.8 7.7 3.8 15 4Z"/></g></svg>`;
  }
  if (kind === "collection") {
    return `<svg class="home-editorial__sketch-frame home-editorial__sketch-frame--collection" viewBox="0 0 350 218" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="home-collection-pencil" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#71947f"/><stop offset=".76" stop-color="#86ab97"/><stop offset="1" stop-color="#a5cec1"/></linearGradient><filter id="home-collection-rough" x="-3%" y="-5%" width="106%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".012 .048" numOctaves="2" seed="19" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale=".78" xChannelSelector="R" yChannelSelector="G"/></filter></defs><g filter="url(#home-collection-rough)"><path d="M15 3.2C74 1.3 132 4.1 189 2.4S285 4.5 336 2.6C344.1 2.8 348 9.4 347.2 18.4 348.1 65 345.6 110 347.4 157L347 201.3C347.2 210.2 342.7 215 334.7 215.2 278 216.7 222 213.8 163 215.6S64 213.8 14.4 215.3C6.4 215.2 2.2 210 2.8 201.5 1.7 142 4 79 2.5 17.8 2.9 8.6 7.3 2.9 15 3.2Z"/><path class="home-editorial__sketch-echo" d="M16 4.6C84 3.2 148 5 212 3.7S301 5 335 4.3C342 4.4 345.5 9.7 345.1 18.8 346 77 343.9 139 345 201 344.9 208.2 341.2 212.4 334 212.8 270 214 206 211.9 141 213.4S59 211.8 15.4 213.2C8.3 213 4.8 208.3 5.1 201 4.2 139 6.2 78 4.7 18.2 5 10.1 8.9 4.3 16 4.6Z"/></g></svg>`;
  }
  return `<svg class="home-editorial__sketch-frame home-editorial__sketch-frame--location" viewBox="0 0 350 192" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="home-location-pencil" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#71947f"/><stop offset=".72" stop-color="#86ab97"/><stop offset="1" stop-color="#a5cec1"/></linearGradient><filter id="home-location-rough" x="-3%" y="-5%" width="106%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".013 .055" numOctaves="2" seed="11" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale=".9" xChannelSelector="R" yChannelSelector="G"/></filter></defs><g filter="url(#home-location-rough)"><path d="M15 3C76 1 127 4 185 2.2S282 4.2 336 2.5C344 2.5 348 9.2 347.3 18.5 348.4 58 345.4 97 347.5 136L347.2 175.5C347.4 184.6 343 189 335 189.4 279 191.1 222 188.2 163 190S64 188.1 14.5 189.7C6.2 189.5 2.2 184.2 2.8 175.6 1.5 125 4.1 72 2.4 17.4 2.8 8.3 7.1 2.6 15 3Z"/><path class="home-editorial__sketch-echo" d="M16 4.5C84 3.2 147 5 211 3.6S300 5 335 4.2C341.9 4.4 345.6 9.6 345.1 18.7 346 65 343.7 112 345.2 175 345.1 182.4 341.2 186.7 334.2 187.2 270 188.7 206 186.4 141 188S59 186.5 15.4 187.7C8.4 187.5 4.8 182.7 5.1 175.1 4.2 121 6.2 70 4.7 18 5 10 8.7 4.2 16 4.5Z"/></g></svg>`;
}

function homeJournalDateLabel() {
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" }).format(new Date());
}

function nearbyHomeSpots() {
  if (!locationReadyForHome()) return [];
  const regional = recommendableCatalogSpots.filter((spot) => spot.region === selectedRegion());
  if (state.location.source !== "gps") return regional.slice(0, 3);
  return regional.map((spot) => ({ spot, distance: discoveryDistance(spot) }))
    .filter((item) => item.distance !== null && item.distance <= 30)
    .sort((a, b) => a.distance - b.distance).slice(0, 3).map((item) => item.spot);
}

const monthlyMomentSpot = allSpots.find((spot) => spot.id === "gangneung-sageunjin");
const monthlyMoment = {
  id: "monthly-sea-walk",
  place: monthlyMomentSpot?.title || "사근진해변",
  description: "맑은 물빛을 따라 천천히 걷기 좋은 곳",
  image: "assets/moa-moment-peek-v1.png",
  imageAlt: "맑은 바다와 파스텔색 방파제가 보이는 풍경",
  month: "10월의 장소",
  likes: 128,
  region: monthlyMomentSpot ? `${monthlyMomentSpot.region} · ${monthlyMomentSpot.area}` : "강원 · 강릉",
  mapQuery: monthlyMomentSpot?.searchQuery || "강릉 사근진해변",
};

const communityMoments = [
  {
    id: "sea-walk",
    place: "강릉 바다",
    description: "물빛이 맑아서 한참 걷고 싶었어요.",
    image: "assets/moa-moment-peek-v1.png",
    imageAlt: "맑은 바다와 파스텔색 방파제가 보이는 풍경",
    likes: 84,
    region: "강원 · 강릉",
    mapQuery: "강릉 바다",
    createdAt: "2026-10-01T09:30:00+09:00",
  },
  {
    id: "seoul-forest-evening",
    place: "서울숲",
    description: "해가 내려앉을 때 천천히 걷기 좋아요.",
    image: "assets/moment-park-concept-v1.png",
    imageAlt: "노을이 비치는 서울숲의 잔디와 호수 풍경",
    likes: 61,
    region: "서울 · 성동구",
    mapQuery: "서울숲",
    createdAt: "2026-09-29T18:20:00+09:00",
  },
];

function recordedMomentItems() {
  return state.explorations.filter((record) => record.photo && record.isPublic === true).map((record, index) => {
    const spot = record.spotId ? allSpots.find((item) => item.id === record.spotId) : null;
    const place = spot?.title || record.place?.trim() || "이름 없는 장소";
    return {
      id: record.id || `recorded-moment-${index}`,
      place,
      description: record.description || "",
      image: record.photo,
      imageAlt: `${place}에서 남긴 방문 사진`,
      likes: 0,
      region: spot ? `${spot.region} · ${spot.area}` : record.region || "직접 등록한 장소",
      address: record.address || "",
      mapQuery: spot?.searchQuery || [record.address, place].filter(Boolean).join(" "),
      createdAt: record.createdAt || new Date(0).toISOString(),
    };
  });
}

function communityMomentItems() {
  const own = recordedMomentItems();
  const knownIds = new Set(own.map(item => item.id));
  const publicItems = state.publicVisits.filter(record => !knownIds.has(record.id)).map(record => ({
    id: record.id, place: record.place, description: record.description || "", image: record.photo,
    imageAlt: `${record.place}에서 남긴 방문 사진`, likes: 0, region: record.region,
    address: record.address, mapQuery: [record.address, record.place].filter(Boolean).join(" "), createdAt: record.createdAt,
  }));
  return [...own, ...publicItems, ...(window.__MOA_RELEASE__ ? [] : communityMoments)];
}

function sortedCommunityMomentItems() {
  const moments = communityMomentItems();
  return moments.sort((a, b) => {
    if (state.momentSort === "popular") {
      const aLikes = momentLikeCount(a);
      const bLikes = momentLikeCount(b);
      return bLikes - aLikes || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function allMomentItems() {
  return [monthlyMoment, ...communityMomentItems()];
}

function momentById(id) {
  return allMomentItems().find((item) => item.id === id);
}

function momentFeature() {
  const moment = monthlyMoment;
  const saved = state.savedMomentIds.includes(moment.id);
  const liked = state.likedMomentIds.includes(moment.id);
  const likeCount = momentLikeCount(moment);
  return `<article class="moment-editorial" data-moment-id="${escapeHtml(moment.id)}" aria-labelledby="moment-editorial-title">
    <div class="moment-editorial__poster">
      <header class="moment-editorial__heading">
        <h1 id="moment-editorial-title">Monthly Pick</h1>
        <p class="moment-editorial__description">10월에 모인 기록과 마음을 집계해<br>11월에 첫 Monthly Pick을 공개할 예정이에요.</p>
      </header>
      <div class="moment-editorial__visual">
        <figure class="moment-editorial__photo">
          <img src="${escapeHtml(moment.image)}" alt="${escapeHtml(moment.imageAlt)}" />
          <svg class="moment-editorial__photo-frame" viewBox="0 0 350 318" preserveAspectRatio="none" aria-hidden="true"><path d="M10 3.5C73 2 126 4.4 187 2.8S287 4.6 340 3.2C345.3 3.3 348 7.8 347.4 14.8 348 102 346 187 347.5 303.5 347.3 311.2 344 315.4 338.2 315.2 276 316.6 218 313.9 158 315.5S61 313.7 10.3 315.3C4.7 315.1 2.2 310.6 2.8 303.2 1.7 203 3.9 105 2.5 14.4 2.8 7.4 5.3 3.2 10 3.5Z"/><path class="moment-editorial__photo-frame-echo" d="M11.2 5C82 3.8 145 5.6 211 4.2S301 5.7 338.8 4.9C343.5 5 345.8 8.9 345.5 15.7 346.2 111 344.2 205 345.7 302.5 345.6 308.9 342.9 312.6 337.5 312.9 271 314.1 205 311.8 140 313.4S57 311.7 10.8 313.1C5.9 312.9 4 309 4.4 302.4 3.4 201 5.3 102 4 15.2 4.2 9 6.7 4.7 11.2 5Z"/></svg>
        </figure>
        <div class="moment-editorial__caption">
          <span class="moment-editorial__stamp">11월 공개 예정</span>
          <span class="moment-editorial__moa" aria-hidden="true"><img src="assets/moa_2d.png" alt=""></span>
        </div>
      </div>
    </div>
    <section class="moment-editorial__place" aria-labelledby="moment-editorial-place">
      <p class="moment-editorial__section-title">공개 전 장소 소개 · 선정 결과가 아니에요</p>
      <h2 id="moment-editorial-place">${escapeHtml(moment.place)}</h2>
      ${moment.description ? `<p class="moment-editorial__place-description">${escapeHtml(moment.description)}</p>` : ""}
    </section>
    <footer class="moment-editorial__footer">
      <div class="moment-engagement-actions"><button type="button" class="moment-like-button${liked ? " is-liked" : ""}" data-moment-like="${escapeHtml(moment.id)}" aria-pressed="${liked}" aria-label="${liked ? "좋아요 취소" : "좋아요"}"><svg viewBox="0 0 28 26" aria-hidden="true"><path d="M14 24C7 19 2 15 2 9.2 2 5.2 4.8 2 8.8 2c2.3 0 4.3 1.1 5.2 2.8C14.9 3.1 16.9 2 19.2 2 23.2 2 26 5.2 26 9.2 26 15 21 19 14 24Z" /></svg><span>${likeCount}</span></button><button type="button" class="moment-save-button${saved ? " is-saved" : ""}" data-moment-save="${escapeHtml(moment.id)}" aria-pressed="${saved}" aria-label="${saved ? "저장 취소" : "이 순간 저장"}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 4.8c0-1 .8-1.8 1.8-1.8h7.4c1 0 1.8.8 1.8 1.8V21L12 17.6 6.5 21V4.8Z"/></svg></button></div>
      <button type="button" data-moment-detail="${escapeHtml(moment.id)}" aria-label="${escapeHtml(moment.place)} 장소 정보 보기"><span>장소 보러가기</span><svg viewBox="0 0 28 20" fill="none" aria-hidden="true"><path d="M2 10h23M18 3l7 7-7 7" /></svg></button>
    </footer>
  </article>`;
}

function momentCommunityFeed() {
  return `<section class="moment-community" aria-labelledby="moment-community-title">
    <svg class="moment-community__divider" viewBox="0 0 350 18" preserveAspectRatio="none" aria-hidden="true"><path d="M2 8.5C48 7.1 87 9.8 130 8.2S220 9.4 264 8.1 318 8.8 348 7.7"/><path class="moment-community__divider-echo" d="M5 11.5C58 10.2 99 12.3 147 10.9s89 1.4 137 0 45 .3 61-.6"/></svg>
    <header class="moment-community__heading">
      <div class="moment-community__kicker"><small>함께 모은 기록</small></div>
      <div class="moment-community__title-row"><h2 id="moment-community-title">사람들이 남긴 순간</h2><div class="moment-community__sort" role="group" aria-label="모아진 순간 정렬">${["latest", "popular"].map((sort) => `<button type="button" data-moment-sort="${sort}" class="${state.momentSort === sort ? "is-active" : ""}" aria-pressed="${state.momentSort === sort}"><span>${sort === "latest" ? "최신순" : "인기순"}</span><svg viewBox="0 0 54 8" preserveAspectRatio="none" aria-hidden="true"><path d="M2 4.8c11-1.6 21 .8 32-.5 7-.8 12 .4 18-.2"/><path d="M5 6.5c10-.8 19 .5 29-.2 6-.4 11 .2 15-.4"/></svg></button>`).join("")}</div></div>
    </header>
    <p class="moment-community__intro">다녀온 곳에서 남긴 사진과 한 줄을 만나보세요.</p>
    <div class="moment-community__feed">${sortedCommunityMomentItems().map((item) => {
      const saved = state.savedMomentIds.includes(item.id);
      const liked = state.likedMomentIds.includes(item.id);
      const likeCount = momentLikeCount(item);
      return `<article class="moment-feed-item" data-moment-id="${escapeHtml(item.id)}">
      <figure class="moment-feed-item__photo"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.imageAlt)}" loading="lazy"></figure>
      <div class="moment-feed-item__content">
        <h3>${escapeHtml(item.place)}</h3>
        ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ""}
        <footer><div class="moment-engagement-actions"><button type="button" class="moment-like-button${liked ? " is-liked" : ""}" data-moment-like="${escapeHtml(item.id)}" aria-pressed="${liked}" aria-label="${liked ? "좋아요 취소" : "좋아요"}"><svg viewBox="0 0 28 26" aria-hidden="true"><path d="M14 24C7 19 2 15 2 9.2 2 5.2 4.8 2 8.8 2c2.3 0 4.3 1.1 5.2 2.8C14.9 3.1 16.9 2 19.2 2 23.2 2 26 5.2 26 9.2 26 15 21 19 14 24Z" /></svg><span>${likeCount}</span></button><button type="button" class="moment-save-button${saved ? " is-saved" : ""}" data-moment-save="${escapeHtml(item.id)}" aria-pressed="${saved}" aria-label="${saved ? "저장 취소" : "이 순간 저장"}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 4.8c0-1 .8-1.8 1.8-1.8h7.4c1 0 1.8.8 1.8 1.8V21L12 17.6 6.5 21V4.8Z"/></svg></button></div><button type="button" data-moment-detail="${escapeHtml(item.id)}" aria-label="${escapeHtml(item.place)} 장소 정보 보기">장소 보러가기 <span aria-hidden="true">→</span></button></footer>
      </div>
    </article>`; }).join("")}</div>
  </section>`;
}

function momentDetailScreen() {
  const moment = momentById(state.selectedMomentId);
  const backAction = state.momentDetailBack === "saved" ? "back-saved" : state.momentDetailBack === "liked-moments" ? "back-liked-moments" : "back-moments";
  const activeTab = state.momentDetailBack === "saved" ? "saved" : state.momentDetailBack === "liked-moments" ? "my" : "moments";
  if (!moment) return `<main class="screen moment-place-screen">${header("장소 정보", backAction)}<section class="moment-place-empty"><h1>장소를 찾지 못했어요</h1><p>하단 메뉴에서 다른 장소를 찾아보세요.</p></section>${bottomNav(activeTab)}</main>`;
  const saved = state.savedMomentIds.includes(moment.id);
  return `<main class="screen moment-place-screen">
    ${header("장소 정보", backAction)}
    <article class="moment-place-detail">
      <figure><img src="${escapeHtml(moment.image)}" alt="${escapeHtml(moment.imageAlt)}"></figure>
      <section>
        <p class="moment-place-detail__region">${escapeHtml(moment.region)}</p>
        <div class="moment-place-detail__title"><h1>${escapeHtml(moment.place)}</h1><button type="button" class="moment-save-button${saved ? " is-saved" : ""}" data-moment-save="${escapeHtml(moment.id)}" aria-pressed="${saved}" aria-label="${saved ? "저장 취소" : "이 순간 저장"}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 4.8c0-1 .8-1.8 1.8-1.8h7.4c1 0 1.8.8 1.8 1.8V21L12 17.6 6.5 21V4.8Z"/></svg></button></div>
        ${moment.description ? `<p class="moment-place-detail__description">${escapeHtml(moment.description)}</p>` : ""}
        ${moment.address ? `<p class="moment-place-detail__note">주소 · ${escapeHtml(moment.address)}</p>` : ""}
        <p class="moment-place-detail__note">정확한 운영 정보와 이동 경로는 선택한 지도에서 확인해 주세요.</p>
        <button type="button" data-moment-report="${escapeHtml(moment.id)}">이 순간 신고하기</button>
        <div class="moment-place-detail__map-actions" aria-label="지도 선택">
          <button type="button" data-map-provider="kakao"><span aria-hidden="true">K</span>카카오맵</button>
          <button type="button" data-map-provider="naver"><span aria-hidden="true">N</span>네이버지도</button>
        </div>
      </section>
    </article>
    ${bottomNav(activeTab)}
  </main>`;
}

async function openMomentMap(moment, provider) {
  const query = encodeURIComponent(moment.mapQuery || moment.place);
  const url = provider === "naver"
    ? `https://map.naver.com/p/search/${query}`
    : `https://map.kakao.com/link/search/${query}`;
  const sdk = window.__AIT_OPEN_URL__;
  if (typeof sdk === "function") {
    await sdk(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

function nearbyPlacesSection() {
  const spots = nearbyHomeSpots();
  const label = state.location.source === "gps" ? "현재 위치에서 직선 30km 이내" : `${selectedRegion()}에서 가볼 곳`;
  return `<section class="home-editorial-nearby" aria-labelledby="home-editorial-nearby-title">
    <div class="home-editorial-section-heading"><div><small>${locationReadyForHome() ? escapeHtml(label) : "위치 확인 후 주변 보기"}</small><h2 id="home-editorial-nearby-title">내 주변 가볼 곳</h2></div>${locationReadyForHome() ? `<button type="button" data-action="open-region">지역 변경</button>` : ""}</div>
    ${spots.length ? `<div class="home-editorial-nearby__list">${spots.map((spot) => `<button type="button" data-home-spot="${escapeHtml(spot.id)}"><span class="home-editorial-nearby__mark" aria-hidden="true">✦</span><span><strong>${escapeHtml(spot.title)}</strong><small>${escapeHtml(spot.region)} · ${escapeHtml(spot.area || "장소")}${state.location.source === "gps" ? ` · 직선 약 ${distanceLabel(discoveryDistance(spot))}` : ""}</small></span></button>`).join("")}</div>${state.screen === "home" ? "" : `<p class="home-editorial-nearby__note">방문 사진 공개 피드는 준비 중이에요. 지금은 해당 지역의 장소를 보여줘요.</p>`}`
      : `<div class="home-editorial-nearby__empty"><span aria-hidden="true">✦</span><strong>${locationReadyForHome() ? "이 범위에서 연결된 장소가 아직 없어요" : "내 위치를 확인해 주세요"}</strong><p>${locationReadyForHome() ? "다른 지역을 선택하거나 장소를 직접 검색해 보세요." : "위치 권한 없이 지역을 직접 선택할 수도 있어요."}</p><div><button type="button" data-action="${locationReadyForHome() ? "open-region" : "request-location"}">${locationReadyForHome() ? "지역 변경" : "내 위치로 보기"}</button>${!locationReadyForHome() ? `<button type="button" data-action="open-region">지역 직접 선택</button>` : ""}</div></div>`}
    ${state.discoveryLocationError ? `<p class="home-editorial-location-error" role="status">${escapeHtml(state.discoveryLocationError)}</p>` : ""}
  </section>`;
}

function homeLocationGate() {
  if (state.homeLocationGateDismissed && state.location.source !== "loading" && !state.discoveryLocationError) return "";
  const loading = state.location.source === "loading";
  return `<section class="home-editorial-location" aria-labelledby="home-editorial-location-title">
    ${homeSketchFrame("location")}
    <small class="home-editorial-location__eyebrow"><span>${homeJournalDateLabel()}</span><i>· 오늘의 페이지</i></small><h2 id="home-editorial-location-title">${loading ? "현재 위치를 확인하고 있어요" : "오늘 가볼 곳을 찾아볼까요?"}</h2>
    <p>${loading ? "가까운 장소를 찾는 중이에요." : "위치를 허용하면 가까운 장소를 보여드려요."}</p>
    ${state.discoveryLocationError ? `<p class="home-editorial-location__error" role="status">${escapeHtml(state.discoveryLocationError)}</p>` : ""}
    ${loading ? "" : `<div class="home-editorial-location__actions"><button type="button" data-action="request-location">내 위치로 보기</button><button type="button" data-action="open-region">지역 직접 선택</button></div>`}
  </section>`;
}

function homeScreen() {
  return `<main class="screen home-editorial-screen">
    <header class="home-editorial__header"><img class="home-editorial__logo" src="assets/logo.png?v=20260929-071630" alt="오늘 뭐하지?"></header>
    <section class="home-editorial__hero" aria-label="모아의 오늘 안내"><svg class="home-editorial__filters" aria-hidden="true"><defs><filter id="home-moa-sticker" x="-12%" y="-12%" width="124%" height="124%" color-interpolation-filters="sRGB"><feMorphology in="SourceAlpha" operator="dilate" radius="11" result="outer"/><feFlood flood-color="#e4ebe5" result="outer-color"/><feComposite in="outer-color" in2="outer" operator="in" result="outer-line"/><feMorphology in="SourceAlpha" operator="dilate" radius="10" result="rim"/><feFlood flood-color="#ffffff" result="rim-color"/><feComposite in="rim-color" in2="rim" operator="in" result="white-rim"/><feMerge><feMergeNode in="outer-line"/><feMergeNode in="white-rim"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs></svg><div class="home-editorial__copy"><small>모아의 제안</small><h1>오늘은 어디를<br>가볼까요?</h1><p class="home-editorial__weather-copy">${escapeHtml(heroWeatherCopy())}</p></div><div class="home-editorial__mascot-group"><span class="home-editorial__mascot-note" aria-hidden="true"><span>${escapeHtml(activeMoaLook().title)}</span><svg viewBox="0 0 120 80" fill="none"><path class="home-editorial__mascot-arrow" d="M8 19C34 3 74 3 83 26c7 17-6 32-23 28-17-4-17-23-3-30 18-9 42 4 49 43"/><path class="home-editorial__mascot-arrow-tip" d="M90 55 107 70 110 47"/></svg></span><img class="home-editorial__mascot" src="${activeMoaLook().image}" alt="오늘의 장소를 제안하는 ${escapeHtml(activeMoaLook().title)}"></div></section>
    <div class="home-editorial__actions"><button type="button" class="home-editorial__primary" data-action="start">모아에게 추천받기</button><button type="button" class="home-editorial__search" data-action="open-search">${homeSketchFrame("search")}${icon("search", 20)}<span>지역이나 장소 검색</span></button></div>
    ${homeMomentEntry()}
    ${discoveryChallengeCard()}
    ${bottomNav("home")}
  </main>`;
}

const homeActivities = [
  { id: "walk", label: "산책하기", interest: "walk" },
  { id: "run", label: "러닝하기", interest: "running" },
  { id: "exhibit", label: "전시 구경", interest: "exhibition" },
  { id: "read", label: "책 읽기", interest: "books" },
  { id: "cafe", label: "카페에서 쉬기", interest: "cafe" },
  { id: "fun", label: "액티비티", interest: "activity" },
];

function activitySketch(id) {
  return `<img class="activity-editorial__illustration" src="assets/activity-${id}-v1.png" alt="" width="280" height="200">`;
}

function activityChoiceFrame() {
  return '<svg class="activity-editorial__frame" viewBox="0 0 180 164" preserveAspectRatio="none" fill="none" aria-hidden="true"><path d="M19 3C54 1 114 4 155 3c15 0 22 9 22 24l-1 104c0 18-8 28-24 29-40 2-92-1-131 0C7 159 3 149 3 133L4 29C3 12 8 5 19 3Z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>';
}

function activityCompanionFrame() {
  return '<svg class="activity-editorial__companion-frame" viewBox="0 0 100 48" preserveAspectRatio="none" fill="none" aria-hidden="true"><path d="M14 3C35 2 64 4 85 3c9 0 12 5 12 13l-1 16c0 9-4 13-12 13-23 1-48-1-70 0C5 45 3 40 3 32L2 17C2 8 5 4 14 3Z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

function activityScreen() {
  const weatherNote = state.weather.status === "ready" && state.weather.region === selectedRegion() && state.weather.kind === "rain"
    ? '<p class="activity-editorial__weather">☂ 비 오는 날엔 실내 활동도 살펴보세요.</p>'
    : '';
  const mainInterests = new Set(homeActivities.map((activity) => activity.interest));
  const otherInterests = Object.entries(interests).filter(([key]) => key !== "all" && key !== "culture" && !mainInterests.has(key));
  return `<main class="screen activity-editorial-screen">
    <header class="activity-editorial__hero">
      <h1>오늘 뭐하지?</h1>
      <img class="activity-editorial__landscape" src="assets/activity-hero-v1.png" alt="도시 풍경을 바라보는 모아" width="2172" height="724">
    </header>
    <section class="activity-editorial__choices" aria-label="오늘 할 행동 선택">
      <p class="activity-editorial__context">오늘 · ${state.location.source === "pilot" ? "내 주변" : escapeHtml(selectedRegion())} · 하고 싶은 일부터</p>
      <div class="activity-editorial__grid">${homeActivities.map((activity) => `<button type="button" class="activity-editorial__choice ${state.interest === activity.interest ? "is-selected" : ""}" data-interest="${activity.interest}" aria-pressed="${state.interest === activity.interest}" aria-label="${activity.label}">${activityChoiceFrame()}${activitySketch(activity.id)}<span>${activity.label}</span>${state.interest === activity.interest ? '<i class="activity-editorial__check" aria-hidden="true">✓</i>' : ""}</button>`).join("")}</div>
      ${weatherNote}
      <div class="activity-editorial__alternatives">
        <p class="activity-editorial__unsure">${state.interest === "all" ? "아직 못 골랐어도 괜찮아요. 전체 활동에서 추천해드려요." : "고른 활동을 중심으로 장소를 추천해드려요."}</p>
        <details class="activity-editorial__more" ${(state.interestChosen && state.interest === "all") || otherInterests.some(([key]) => key === state.interest) ? "open" : ""}>
          <summary><span>다른 활동 더 보기</span><svg class="activity-editorial__more-chevron" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></summary>
          <div class="activity-editorial__chips"><button type="button" class="${state.interestChosen && state.interest === "all" ? "is-selected" : ""}" data-interest="all" aria-pressed="${state.interestChosen && state.interest === "all"}">아직 못 골랐어요</button>${otherInterests.map(([key, option]) => `<button type="button" class="${state.interest === key ? "is-selected" : ""}" data-interest="${key}" aria-pressed="${state.interest === key}">${option.label}</button>`).join("")}</div>
        </details>
      </div>
    </section>
    <section class="activity-editorial__preferences" aria-label="함께 가는 사람과 지역">
      <div class="activity-editorial__field"><h2>누구와 함께?</h2><div class="activity-editorial__chips activity-editorial__companions">${Object.entries(companionOptions).map(([key, label]) => `<button type="button" class="${state.companion === key ? "is-selected" : ""}" data-companion="${key}" aria-pressed="${state.companion === key}">${activityCompanionFrame()}<span>${label}</span></button>`).join("")}</div></div>
      <div class="activity-editorial__location"><span>${state.location.source === "pilot" ? "둘러볼 지역을 선택해 주세요" : escapeHtml(state.location.label)}</span><button type="button" data-action="open-region">지역 변경</button></div>
    </section>
    <div class="activity-editorial__continue"><button type="button" data-action="show-result">${state.interest === "all" ? "장소 둘러보기" : `${escapeHtml(homeActivities.find((activity) => activity.interest === state.interest)?.label || interests[state.interest].label)} 장소 보기`}</button><button type="button" class="activity-editorial__search" data-action="open-search">직접 지역·장소 찾기 <span aria-hidden="true">→</span></button></div>
    ${bottomNav("home")}
  </main>`;
}

function momentsScreen() {
  return `<main class="screen moment-editorial-screen">${momentFeature()}${momentCommunityFeed()}${bottomNav("moments")}</main>`;
}

function visitAddressFields() {
  if (!state.verify.custom) return `<div class="verify-location">⌖ ${escapeHtml(state.verify.region || state.location.label)} · 방문 지역</div>`;
  const lookup = state.verify.addressLookup;
  return `<div class="verify-address">
    <label for="verify-address">다녀온 장소 주소 <span>필수</span></label>
    <div class="verify-address__entry"><input id="verify-address" type="text" required maxlength="80" autocomplete="off" placeholder="도로명 주소를 입력하거나 장소를 검색해 주세요" value="${escapeHtml(state.verify.address)}" aria-describedby="verify-address-hint"><button type="button" data-action="search-visit-address" ${lookup.status === "loading" ? "disabled" : ""}>${lookup.status === "loading" ? "검색 중…" : "주소 검색"}</button></div>
    <p id="verify-address-hint">공개할 장소의 주소를 적어주세요. 집 주소 등 개인 정보는 적지 마세요.</p>
    ${lookup.message ? `<p class="verify-address__feedback" role="status">${escapeHtml(lookup.message)}</p>` : ""}
    ${lookup.results.length ? `<div class="verify-address__results" aria-label="방문 장소 주소 검색 결과">${lookup.results.map((item, index) => `<button type="button" data-visit-address-result="${index}"><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.address)}</span></button>`).join("")}</div>` : ""}
  </div>`;
}

async function searchVisitAddress() {
  const draft = state.verify;
  const query = draft.address.trim();
  if (!query) { document.querySelector("#verify-address")?.focus(); return; }
  const lookup = { status: "loading", results: [], message: "" };
  draft.addressLookup = lookup;
  render();
  try {
    const response = await fetch(`/api/origins?query=${encodeURIComponent(query)}`);
    const data = await response.json();
    if (state.verify !== draft || !draft.open || draft.step !== "photo" || draft.address.trim() !== query || draft.addressLookup !== lookup) return;
    const results = response.ok && Array.isArray(data.results) ? data.results.filter((item) => typeof item.address === "string" && item.address.trim() && hasCoords(item) && regions.some((region) => normalizedRegion(region) === item.region)) : [];
    draft.addressLookup = { status: response.ok ? "ready" : "error", results, message: results.length ? "다녀온 장소의 주소를 선택해 주세요." : response.ok ? "검색 결과가 없어요. 정확한 주소를 직접 입력해 주세요." : "주소 검색을 사용할 수 없어요. 정확한 주소를 직접 입력해 주세요." };
  } catch {
    if (state.verify !== draft || !draft.open || draft.step !== "photo" || draft.address.trim() !== query || draft.addressLookup !== lookup) return;
    draft.addressLookup = { status: "error", results: [], message: "주소 검색에 연결하지 못했어요. 정확한 주소를 직접 입력해 주세요." };
  }
  render();
}

function visitReflectionFields() {
  return `<div class="verify-reflection">
    <label for="verify-description">이곳에서의 순간은 어땠나요? <span>선택</span></label>
    <textarea id="verify-description" rows="2" maxlength="100" placeholder="예: 바람이 시원해서 잠깐 쉬기 좋았어요." aria-describedby="verify-description-hint">${escapeHtml(state.verify.description || "")}</textarea>
    <small id="verify-description-hint">한 줄은 비워도 괜찮아요. 최대 100자</small>
  </div>
  <div class="verify-publishing">
    <label for="verify-is-public"><input id="verify-is-public" type="checkbox" ${state.verify.isPublic === true ? "checked" : ""} aria-describedby="verify-public-hint"><span>모아진 순간에도 공개하기</span></label>
    <p id="verify-public-hint">선택하면 사진과 한 줄, 장소가 함께 공개돼요.<br>선택하지 않으면 내 기록에만 남아요.</p>
  </div>`;
}

function verificationSheet() {
  if (state.verify.step === "place") {
    const spot = allSpots.find((item) => item.id === state.selectedSpotId);
    return `<div class="sheet-backdrop verify-backdrop" data-action="close-verify"><section class="verify-sheet" role="dialog" aria-modal="true" aria-labelledby="verify-title"><div class="sheet-handle"></div><p class="eyebrow">방문 기록</p><h2 id="verify-title">어디를 다녀왔나요?</h2><p>다녀온 장소를 고르고 사진을 남겨주세요.</p>${spot ? `<button type="button" class="verify-place" data-verify-spot-id="${escapeHtml(spot.id)}"><span><strong>${escapeHtml(spot.title)}</strong><small>${escapeHtml(spot.region)} · ${escapeHtml(spot.area)}</small></span><b>›</b></button>` : ""}<button type="button" class="verify-place" data-action="search-verify-place"><span><strong>${spot ? "다른 등록 장소 찾기" : "등록된 장소에서 선택하기"}</strong><small>장소를 검색하고 현장에서 인증할 수 있어요</small></span><b>›</b></button><button type="button" class="verify-place" data-verify-place="직접 선택한 장소"><span><strong>목록에 없는 장소 직접 기록하기</strong><small>다녀온 장소 이름을 직접 적을 수 있어요</small></span><b>›</b></button><button class="sheet-close" data-action="close-verify">닫기</button></section></div>`;
  }
  const spot = allSpots.find((item) => item.id === state.verify.spotId);
  const rewardTheme = !state.verify.custom ? discoveryRewardForSpot(spot) : null;
  return `<div class="sheet-backdrop verify-backdrop"><section class="verify-sheet verify-photo-sheet" role="dialog" aria-modal="true" aria-labelledby="photo-title"><div class="sheet-handle"></div><p class="eyebrow">${state.verify.custom ? "내가 찾은 장소" : escapeHtml(state.verify.place)}</p><h2 id="photo-title">오늘의 순간을 남겨주세요</h2>${state.verify.custom ? `<label class="verify-place-name">다녀온 장소 이름<input id="verify-place-name" type="text" placeholder="예: 동네 작은 서점" value="${escapeHtml(state.verify.place)}"></label>` : ""}${visitAddressFields()}<p class="verify-caveat">${rewardTheme ? "오늘의 발견 카드는 이 장소 근처에서 현재 위치와 사진을 확인한 뒤에만 받아요. 좌표와 사진은 카드 기록에 저장하지 않아요." : "현장 위치 확인 없이 사진을 기록해요. 카드는 지급되지 않아요."}</p>${state.verify.photo ? `<div class="verify-photo-preview"><img src="${state.verify.photo}" alt="선택한 인증 사진"></div>` : `<div class="verify-photo-empty"><span aria-hidden="true">📷</span><strong>방문한 장소의 사진을 올려주세요</strong><small>아래에서 촬영하거나 앨범에서 고를 수 있어요</small></div>`}<div class="verify-photo-sources"><label class="verify-source-button"><span aria-hidden="true">📷</span>사진 촬영<input id="verify-camera-input" type="file" accept="image/*" capture="environment"></label><label class="verify-source-button"><span aria-hidden="true">▧</span>앨범에서 선택<input id="verify-album-input" type="file" accept="image/*"></label></div>${visitReflectionFields()}${state.verify.error ? `<p class="verify-reward-error" role="alert">${escapeHtml(state.verify.error)}</p>` : ""}<button type="button" class="primary-button" data-action="complete-verify" ${visitPhotoReady() && !state.verify.checking ? "" : "disabled"}><span>✓</span>${state.verify.checking ? "현장 위치 확인 중…" : rewardTheme ? "현장 인증하고 카드 받기" : "방문 사진 기록하기"}</button>${rewardTheme ? `<button type="button" class="verify-photo-only" data-action="record-photo-only" ${visitPhotoReady() && !state.verify.checking ? "" : "disabled"}>사진만 기록하기 · 카드는 받지 않기</button>` : ""}<button class="sheet-close" data-action="close-verify">닫기</button></section></div>`;
}

function searchScreen() {
  const region = selectedRegion();
  const hasLocalSpots = allSpots.some((spot) => spot.region === region);
  return `<main class="screen search-screen">
    <header class="search-header search-header--native"><label>${icon("search",22)}<input id="place-search" type="search" placeholder="지역·장소 검색" autocomplete="off"><button type="button" data-clear-search aria-label="검색어 지우기">×</button></label></header>
    <div class="search-body">
      <div class="search-scope"><span>${region} 전체에서 둘러볼 장소</span><button type="button" data-action="open-region">지역 바꾸기 ›</button></div>
      <section class="content-section"><div class="section-heading"><div><span>장소 목록</span><h2 id="search-results-title">${region} 장소 목록</h2></div><small id="search-results-scope">운영 여부는 방문 전 확인</small></div><div class="search-results">
        ${allSpots.map((spot) => `<button type="button" data-search-spot="${escapeHtml(spot.id)}" data-analytics-card="search" data-spot-id="${escapeHtml(spot.id)}" data-spot-region="${escapeHtml(spot.region)}" data-spot-search="${escapeHtml(`${spot.title} ${spot.region} ${spot.area}`)}" ${spot.region === region ? "" : "hidden"}><span><strong>${escapeHtml(spot.title)}</strong><small>${escapeHtml(spot.region)} · ${escapeHtml(spot.area)}</small></span><em>장소 보기 ›</em></button>`).join("")}
      </div><div class="search-empty" data-analytics-empty="${hasLocalSpots ? "search_query" : "search_region"}" ${hasLocalSpots ? "hidden" : ""}>${mascot("base-explorer","medium")}<strong>${hasLocalSpots ? "검색 결과가 없어요" : "이 지역의 장소는 아직 준비 중이에요"}</strong><span>${hasLocalSpots ? "다른 지역이나 장소 이름으로 찾아보세요." : "지역을 바꾸거나 다른 장소를 검색해보세요."}</span></div></section>
    </div>
  </main>`;
}

function friendsScreen() {
  return `<main class="screen tab-screen friends-screen">
    <header class="tab-header"><div><p class="eyebrow">함께 가기</p><h1>친구와 같이 떠나요</h1><p>마음에 드는 장소를 친구에게 보내보세요.</p></div>${mascot("invite", "medium", "친구에게 장소를 보내는 모아")}</header>
    <section class="empty-state friends-empty">${icon("friends", 32)}<h2>아직 함께 고른 장소가 없어요</h2><p>장소 후보를 고른 뒤 친구에게 공유해 보세요.</p><button type="button" data-action="open-search">장소 둘러보기</button></section>
    ${bottomNav("friends")}
    ${state.shareOpen ? shareSheet() : ""}
  </main>`;
}

function simpleTabScreen(kind) {
  if (kind === "my") return myScreen();
  const moments = allMomentItems();
  const savedSpots = [...state.savedSpotIds].reverse().map(id => allSpots.find(spot => spot.id === id)).filter(Boolean);
  const savedMoments = [...state.savedMomentIds].reverse().map(id => moments.find(moment => moment.id === id)).filter(Boolean);
  const isMoment = state.savedTab === "moments";
  const items = isMoment ? savedMoments : savedSpots;
  const unavailable = (isMoment ? state.savedMomentIds.length : state.savedSpotIds.length) - items.length;
  return `<main class="screen saved-editorial-screen">
    <header class="saved-editorial-header"><p>다시 꺼내 보고 싶은</p><h1>나의 저장</h1><span>가고 싶은 곳과 마음에 남은 순간을 모아요.</span></header>
    <div class="saved-editorial-tabs" role="tablist" aria-label="저장 유형">${[["places", "장소", savedSpots.length], ["moments", "순간", savedMoments.length]].map(([key,label,count]) => `<button type="button" role="tab" id="saved-tab-${key}" aria-controls="saved-panel" aria-selected="${(isMoment ? "moments" : "places") === key}" data-saved-tab="${key}">${label}<span>${count}</span></button>`).join("")}</div>
    <section id="saved-panel" role="tabpanel" aria-labelledby="saved-tab-${isMoment ? "moments" : "places"}">
      <p class="saved-editorial-caption">${isMoment ? "사진에 담긴 순간, 다시 만나보세요." : "다음 나들이에 꺼내 볼 장소들이에요."}</p>
      ${items.length ? `<div class="${isMoment ? "saved-editorial-moments" : "saved-editorial-places"}">${isMoment ? savedMoments.map(moment => `<button type="button" data-saved-moment="${escapeHtml(moment.id)}"><img src="${escapeHtml(moment.image)}" alt="${escapeHtml(moment.imageAlt || moment.place)}" loading="lazy"><span><small>${escapeHtml(moment.region || "모아진 순간")}</small><strong>${escapeHtml(moment.place)}</strong>${moment.description ? `<span class="saved-editorial-description">${escapeHtml(moment.description)}</span>` : ""}</span></button>`).join("") : savedSpots.map(spot => `<button type="button" data-saved-spot="${escapeHtml(spot.id)}" data-analytics-card="saved" data-spot-id="${escapeHtml(spot.id)}"><span><small>${escapeHtml([spot.region,spot.area].filter(Boolean).join(" · "))}</small><strong>${escapeHtml(spot.title)}</strong></span><span aria-hidden="true">↗</span></button>`).join("")}</div>` : `<div class="saved-editorial-empty">${!isMoment ? '<img class="saved-editorial-empty__moa" src="assets/moa-moment-peek-v1.png" alt="" aria-hidden="true">' : ""}<p>${isMoment ? "간직하고 싶은 장면을 찾아볼까요?" : "다음에 가고 싶은 곳이 있나요?"}</p><h2>아직 저장한 ${isMoment ? "순간이" : "장소가"} 없어요</h2><span>${isMoment ? "모아진 순간에서 북마크를 누르면<br>사진과 이야기를 여기서 다시 볼 수 있어요." : "장소 정보에서 북마크를 누르면<br>가고 싶은 곳을 여기서 다시 볼 수 있어요."}</span><button type="button" ${isMoment ? 'data-tab="moments"' : 'data-action="open-search"'}>${isMoment ? "순간 구경하기" : "장소 둘러보기"} <span aria-hidden="true">→</span></button></div>`}
      ${unavailable > 0 ? '<p class="saved-editorial-unavailable">지금 볼 수 없는 저장 항목이 있어요. 삭제되거나 공개가 해제되었을 수 있어요.</p>' : ""}
    </section>
    ${bottomNav("saved")}
  </main>`;
}

function discoveryBook() {
  const collectedCards = [...state.discoveryRecords].reverse();
  const cardCount = state.discoveryRecords.length;
  const nextReward = cardCount < 3
    ? `사진꽃 모아까지 ${3 - cardCount}장`
    : cardCount < 10
      ? `폴라로이드 모아까지 ${10 - cardCount}장`
      : cardCount < 20
        ? `카드 라이더 모아까지 ${20 - cardCount}장`
        : "모든 모아를 만났어요";
  return `<section class="discovery-book my-editorial-book"><div class="section-heading my-editorial-section-heading"><div><span>나의 발견</span><h2>모아의 발견책</h2></div><small>모아 ${moaLooks.filter(moaLookUnlocked).length}개</small></div>
    <p class="discovery-book-summary">${nextReward}${cardCount < 20 ? " 남았어요" : ""}</p>
    ${legacyDiscoveryCount() ? `<p class="discovery-book-legacy">이전 탭 수집 ${legacyDiscoveryCount()}장은 그대로 보관하지만 해금에는 포함되지 않아요.</p>` : ""}
    ${collectedCards.length ? '<button type="button" class="discovery-book-looks" data-action="open-moa-looks">모아 꾸미기 살펴보기 <span>→</span></button>' : ""}
    ${collectedCards.length ? `<p class="discovery-book-record-label">현장 인증 카드 · ${cardCount}장</p><div class="discovery-book-list">${collectedCards.map((item) => {
      const theme = discoveryThemeById(item.themeId) || { title: "현장 인증", symbol: "✓" };
      return `<button type="button" data-discovery-card-date="${item.date}" aria-label="${escapeHtml(theme.title)} 카드 보기"><span aria-hidden="true">${theme.symbol}</span><strong>${theme.title}</strong><small>${item.region ? `${escapeHtml(item.region)} · ` : ""}${item.date.replaceAll("-", ".")}</small></button>`;
    }).join("")}</div>` : `<div class="discovery-book-empty"><p>방문 인증을 쌓고 새로운 모아를 만나보세요.</p><button type="button" data-action="open-moa-looks">모아 보상 카드 보기</button></div>`}
  </section>`;
}

function discoveryRewardSheet() {
  const preview = state.rewardPreviewOpen;
  const previewTheme = preview ? todayDiscovery().theme || discoveryThemes[0] : null;
  const previewSpot = preview ? discoveryCandidate(previewTheme) : null;
  const record = preview ? { date: localDateKey(), themeId: previewTheme.id, spotId: previewSpot?.id || "", region: selectedRegion() }
    : state.discoveryRecords.find((item) => item.date === state.openDiscoveryCardDate);
  if (!record) return "";
  const theme = discoveryThemeById(record.themeId);
  const spot = catalogSpots.find((item) => item.id === record.spotId);
  const place = spot?.title || `${record.region || "방문한 지역"}에서의 발견`;
  return `<div class="sheet-backdrop discovery-reward-backdrop" data-action="close-discovery-card"><section class="discovery-reward-sheet" role="dialog" aria-modal="true" aria-labelledby="discovery-reward-title">
    <button type="button" class="discovery-reward-close" data-action="close-discovery-card" aria-label="카드 닫기">×</button>
    <p class="discovery-reward-intro">${preview ? "디자인 미리보기 · 획득 전" : state.rewardCardFresh ? "현장 인증 완료!" : "모아의 발견책"}</p><h2 id="discovery-reward-title">${preview ? "이런 카드를 받을 수 있어요" : state.rewardCardFresh ? "오늘의 카드를 받았어요" : "내가 모은 발견 카드"}</h2>
    <article class="discovery-reward-card" aria-label="${escapeHtml(theme.title)} 카드, ${escapeHtml(place)} ${preview ? "미리보기" : "방문 인증"}">
      <div class="discovery-reward-card-header"><span>오늘의 발견</span><span>${escapeHtml(record.date.replaceAll("-", "."))}</span></div>
      <div class="discovery-reward-art"><span class="discovery-reward-symbol" aria-hidden="true">${theme.symbol}</span><img src="assets/moa-base-explorer-v1.png" alt="모아"></div>
      <div class="discovery-reward-card-copy"><span>${preview ? "획득 전 미리보기" : "현장 인증 카드"}</span><h3>${escapeHtml(theme.title)}</h3><p>${escapeHtml(place)}</p><small>${escapeHtml(record.region || spot?.region || "방문 지역")} · ${preview ? "현장 인증 후 획득" : "위치와 사진 인증 완료"}</small></div>
    </article>
    <p class="discovery-reward-note">${preview ? "예시 카드는 저장되거나 카드 수에 포함되지 않아요." : "방문 사진은 카드에 넣지 않고, 나의 탐험 기록에서 볼 수 있어요."}</p>
    <button type="button" class="discovery-reward-primary" data-action="${preview ? "close-discovery-card" : "open-discovery-book"}">${preview ? "미리보기 닫기" : "내 카드 보관함 보기"}</button>
  </section></div>`;
}

function orderedVisits() {
  return [...state.explorations].sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
}

function visitThumbnail(item) {
  const date = new Date(item.createdAt);
  const label = Number.isNaN(date.getTime()) ? "방문 기록" : date.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
  return `<button type="button" class="my-visit-thumbnail" data-visit-detail="${escapeHtml(item.id)}"><img src="${escapeHtml(item.photo)}" alt="" loading="lazy"><span><strong>${escapeHtml(item.place)}</strong><small>${escapeHtml(label)} · ${item.isPublic ? "공개" : "나만 보기"}</small></span></button>`;
}

function visitHistoryScreen() {
  const visits = orderedVisits();
  const groups = new Map();
  visits.slice(0, state.visitListLimit).forEach(item => {
    const date = new Date(item.createdAt);
    const month = Number.isNaN(date.getTime()) ? "날짜 없는 기록" : `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
    if (!groups.has(month)) groups.set(month, []);
    groups.get(month).push(item);
  });
  return `<main class="screen tab-screen my-editorial-screen"><header class="my-editorial-header"><p>나의 기록</p><h1>방문 인증 기록</h1><span>다녀온 순간 ${visits.length}개를 모았어요.</span></header>${MANY_VISITS_PREVIEW ? '<p class="my-visit-demo">24개 기록 미리보기 · 예시 사진을 반복 사용했어요.</p>' : ""}${[...groups].map(([month, items]) => `<section class="my-visit-month"><h2>${month}</h2><div class="my-visit-grid">${items.map(visitThumbnail).join("")}</div></section>`).join("")}${!visits.length ? recentExploration() : ""}${visits.length > state.visitListLimit ? '<button type="button" class="my-visit-more" data-action="more-visits">이전 기록 더 보기 ↓</button>' : ""}${bottomNav("my")}</main>`;
}

function visitDetailScreen() {
  const item = state.explorations.find(item => item.id === state.selectedVisitId);
  return `<main class="screen tab-screen my-editorial-screen"><header class="my-editorial-header"><p>나의 기록</p><h1>다녀온 순간</h1></header>${item ? recentExploration([item]) : '<p>기록이 없어요.</p>'}<button type="button" class="my-visit-more" data-screen="visit-history">전체 기록 보기</button>${bottomNav("my")}</main>`;
}

function myScreen() {
  const count = state.explorations.length;
  const moaCount = moaLooks.filter(moaLookUnlocked).length;
  return `<main class="screen tab-screen my-screen my-editorial-screen">
    <header class="my-editorial-header"><p>나의 기록</p><h1>나의 탐험</h1><svg class="my-editorial-header__doodle" viewBox="0 0 116 18" aria-hidden="true"><path d="M3 11c24-4 49-5 73-2 15 2 26 1 37-3"/><path d="M88 14c9-1 17-3 24-7"/></svg><span>다녀온 장소와 모은 순간을 기록해요.</span></header>
    <section class="my-editorial-overview" aria-label="나의 탐험 요약">
      <svg class="my-editorial-overview__filters" aria-hidden="true"><defs><filter id="my-moa-sticker" x="-14%" y="-14%" width="128%" height="128%" color-interpolation-filters="sRGB"><feMorphology in="SourceAlpha" operator="dilate" radius="8" result="rim"/><feFlood flood-color="#ffffff" result="rim-color"/><feComposite in="rim-color" in2="rim" operator="in" result="white-rim"/><feMerge><feMergeNode in="white-rim"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs></svg>
      <img src="${activeMoaLook().image}" alt="현재 선택한 ${escapeHtml(activeMoaLook().title)}">
      <div class="my-editorial-stats"><span>다녀온 곳<strong>${count}<small>곳</small></strong></span><span>모은 모아<strong>${moaCount}<small>개</small></strong></span></div>
    </section>
    <nav class="my-editorial-index" aria-label="나의 탐험 메뉴">
      <button type="button" data-screen="dogam"><span class="my-editorial-index__number">01</span><span><strong>나의 도감</strong><small>지역별로 모은 장소</small></span><b aria-hidden="true">→</b></button>
      <button type="button" data-screen="map"><span class="my-editorial-index__number">02</span><span><strong>탐험 지도</strong><small>다녀온 곳을 지도에서 보기</small></span><b aria-hidden="true">→</b></button>
      <button type="button" data-screen="liked-moments"><span class="my-editorial-index__number">03</span><span><strong>좋아요한 순간</strong><small>내가 마음을 남긴 공개 순간 · ${state.likedMomentIds.length}개</small></span><b aria-hidden="true">→</b></button>
    </nav>
    ${discoveryBook()}
    <details class="my-analytics-settings"><summary>이용 분석 설정</summary><p>선택 동의 시 Google Analytics로 화면 조회와 주요 버튼 이용 정보를 보내 서비스 개선에 사용해요. Google이 기기·브라우저 정보와 분석용 쿠키를 처리하며, 사진·입력 문구·주소·정밀 좌표·토스 식별키는 보내지 않아요. 동의하지 않아도 앱을 사용할 수 있고 언제든 끌 수 있어요.</p><a href="https://policies.google.com/privacy?hl=ko" target="_blank" rel="noopener noreferrer">Google 개인정보처리방침</a><button type="button" data-action="toggle-ga-consent" aria-pressed="${Boolean(window.MoaAnalytics?.enabled())}">${window.MoaAnalytics?.enabled() ? "이용 분석 동의 철회" : "선택 동의하고 이용 분석 켜기"}</button></details>
    <section class="content-section my-editorial-history"><div class="section-heading my-editorial-section-heading"><div><span>나의 기록</span><h2>방문 인증 기록</h2></div><button type="button" class="my-visit-all" data-screen="visit-history">전체 보기 · ${count}</button></div>${count ? `<div class="my-visit-recent">${orderedVisits().slice(0, 3).map(visitThumbnail).join("")}</div>` : recentExploration()}${MANY_VISITS_PREVIEW ? '<p class="my-visit-demo">24개 샘플 중 최근 3개 · 실제 저장되지 않아요.</p>' : ""}</section>
    ${bottomNav("my")}
  </main>`;
}

function likedMomentsScreen() {
  const likedMoments = allMomentItems().filter((moment) => state.likedMomentIds.includes(moment.id));
  return `<main class="screen tab-screen my-editorial-screen my-liked-screen">
    <header class="my-liked-header"><div><p>나의 마음</p><h1>좋아요한 순간</h1><span>마음을 남긴 사진과 장소를 다시 살펴봐요.</span></div></header>
    ${likedMoments.length ? `<section class="my-liked-list" aria-label="좋아요한 순간 ${likedMoments.length}개">${likedMoments.map((moment) => `<article><button type="button" class="my-liked-item" data-moment-detail="${escapeHtml(moment.id)}"><img src="${escapeHtml(moment.image)}" alt="${escapeHtml(moment.imageAlt)}"><span><small>${escapeHtml(moment.region)}</small><strong>${escapeHtml(moment.place)}</strong>${moment.description ? `<em>${escapeHtml(moment.description)}</em>` : ""}</span></button><button type="button" class="my-liked-remove" data-moment-like="${escapeHtml(moment.id)}" aria-label="${escapeHtml(moment.place)} 좋아요 취소"><svg viewBox="0 0 28 26" aria-hidden="true"><path d="M14 24C7 19 2 15 2 9.2 2 5.2 4.8 2 8.8 2c2.3 0 4.3 1.1 5.2 2.8C14.9 3.1 16.9 2 19.2 2 23.2 2 26 5.2 26 9.2 26 15 21 19 14 24Z" /></svg></button></article>`).join("")}</section>` : `<section class="my-liked-empty"><span aria-hidden="true">♡</span><h2>아직 좋아요한 순간이 없어요</h2><p>모아진 순간에서 마음에 드는 사진에<br>하트를 남겨보세요.</p><button type="button" data-tab="moments">모아진 순간 보기 <span aria-hidden="true">→</span></button></section>`}
    ${bottomNav("my")}
  </main>`;
}

function dogamScreen() {
  const unlocked = dogamCatalogSpots.filter((spot) => state.explorations.some((item) => item.spotId === spot.id)).length;
  const customItems = state.explorations.filter((item) => !dogamCatalogSpots.some((spot) => spot.id === item.spotId));
  const regionOrder = ["서울", "경기", "인천", "부산", "대구", "대전", "광주", "울산", "세종", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"];
  const chapters = regionOrder.map((region) => {
    const spots = dogamCatalogSpots.filter((spot) => spot.region === region);
    if (!spots.length) return "";
    const count = spots.filter((spot) => state.explorations.some((item) => item.spotId === spot.id)).length;
    const ordered = [...spots.filter((spot) => state.explorations.some((item) => item.spotId === spot.id)), ...spots.filter((spot) => !state.explorations.some((item) => item.spotId === spot.id))];
    const expanded = state.dogamExpandedRegions.includes(region);
    const shown = expanded ? ordered : ordered.slice(0, 6);
    return `<section class="dogam-chapter-v2"><div class="dogam-chapter-heading"><h2>${region}</h2><span>${count}/${spots.length}</span></div><div class="dogam-progress"><i style="width:${count / spots.length * 100}%"></i></div><div class="dogam-grid-v2">${shown.map((spot) => {
      const item = state.explorations.find((entry) => entry.spotId === spot.id);
      return `<button type="button" class="dogam-slot ${item ? "is-unlocked" : ""}" ${item ? "" : `data-dogam-spot-id="${escapeHtml(spot.id)}"`}>${item ? `<span class="dogam-slot-image"><img src="${item.photo}" alt="방문 기록 사진"></span>` : ""}<strong>${escapeHtml(spot.title)}</strong><small>${item ? "✓ 방문 인증" : `${escapeHtml(spot.area)} · 인증하기 ›`}</small></button>`;
    }).join("")}</div>${spots.length > 6 ? `<button type="button" class="dogam-more" data-dogam-region="${region}">${expanded ? "접기" : `스팟 더보기 (+${spots.length - 6})`}</button>` : ""}</section>`;
  }).join("");
  return `<main class="screen tab-screen collection-screen">
    ${header("나의 도감", "back-my")}
    <div class="collection-intro"><div><p class="eyebrow">모은 순간</p><h1>다녀온 만큼 채워져요</h1><p>방문 사진이 나만의 도감 카드가 돼요.</p></div>${mascot("base-explorer", "medium")}</div>
    <p class="collection-count">원본 스팟 <strong>${dogamCatalogSpots.length}</strong>곳 · 이 미리보기에서 인증 ${unlocked}곳</p>
    <p class="dogam-data-note">기존 앱의 수집 기록은 아직 연결되지 않았어요. 이 화면에서 새로 남긴 인증만 채워져요.</p>
    ${chapters}
    ${customItems.length ? `<section class="dogam-chapter-v2"><div class="dogam-chapter-heading"><h2>내 스팟</h2><span>${customItems.length}곳</span></div><div class="dogam-grid-v2">${customItems.map((item) => `<article class="dogam-slot is-unlocked"><span class="dogam-slot-image"><img src="${item.photo}" alt=""></span><strong>${escapeHtml(item.place)}</strong><small>${escapeHtml(item.region)} · 방문 인증</small></article>`).join("")}</div></section>` : ""}
    ${bottomNav("my")}
  </main>`;
}

function mapScreen() {
  const groups = state.explorations.reduce((result, item) => {
    (result[item.region] ||= []).push(item);
    return result;
  }, {});
  const selected = groups[state.mapRegion] || [];
  const pins = Object.entries(groups).filter(([region]) => mapRegionPositions[region]).map(([region, items]) => {
    const [x, y] = mapRegionPositions[region];
    return `<button type="button" class="exploration-pin ${state.mapRegion === region ? "is-selected" : ""}" style="left:${x}%;top:${y}%" data-map-region="${region}" aria-label="${region} ${items.length}곳"><strong>${items.length}</strong><span>${region}</span></button>`;
  }).join("");
  return `<main class="screen tab-screen exploration-map-screen">
    ${header("탐험 지도", "back-my")}
    <div class="map-intro"><p class="eyebrow">나의 장소</p><h1>내가 다녀온 곳</h1><p>방문 인증을 남기면 지도에 핀이 생겨요 · ${state.explorations.length}곳</p></div>
    <div class="exploration-map"><img src="assets/map.png" alt="대한민국 일러스트 지도">${pins}${state.explorations.length ? "" : `<div class="map-empty-v2"><span>📍</span><strong>아직 찍은 핀이 없어요</strong><small>첫 방문 사진을 남겨보세요.</small></div>`}</div>
    ${state.mapRegion ? `<section class="map-record-panel"><div class="section-heading"><h2>${escapeHtml(state.mapRegion)} · ${selected.length}곳</h2><button type="button" class="text-button" data-action="clear-map-region">닫기</button></div>${selected.map((item) => `<article><img src="${item.photo}" alt=""><div><strong>${escapeHtml(item.place)}</strong><span>방문 인증 사진</span></div></article>`).join("")}</section>` : ""}
    <button type="button" class="map-add-button" data-action="open-verify">＋ 새 탐험 인증하기</button>
    ${bottomNav("my")}
  </main>`;
}

function conditionScreen() {
  return activityScreen();
}

function browseEditorialCard(spot, index, hasOrigin) {
  return `<article class="browse-editorial__item" data-analytics-card="recommendation" data-spot-id="${escapeHtml(spot.id)}" data-recommendation-reason="${escapeHtml(spotReason(spot))}">
    <button type="button" class="browse-editorial__place" data-browse-spot="${escapeHtml(spot.id)}">
      <span class="browse-editorial__area">${escapeHtml(spot.region)} · ${escapeHtml(spot.area)}</span>
      <span class="browse-editorial__name"><strong>${escapeHtml(spot.title)}</strong><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></span>
      <span class="browse-editorial__reason">${escapeHtml(spot.desc || spotReason(spot))}</span>
    </button>
    ${crowdContext(spot)}
    <div class="browse-editorial__footer"><span class="browse-editorial__distance"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>${spot.distanceKm != null ? `직선 약 ${distanceLabel(spot.distanceKm)}` : "거리 확인 전"}</span><button type="button" data-map-link="recommendation" data-spot-id="${escapeHtml(spot.id)}" aria-haspopup="dialog">길찾기 <span aria-hidden="true">↗</span></button></div>
  </article>`;
}

function browseScreen() {
  const matches = browseCandidates();
  const visible = matches.slice(0, state.browseCount);
  const hasOrigin = hasCoords(originCoords());
  const filterSummary = companionOptions[state.companion];
  const activity = homeActivities.find((item) => item.interest === state.interest);
  const selection = activity ? activityBrowseSelection() : null;
  const activityTitles = { walk: "산책할 곳", running: "달리기 할 곳", exhibition: "전시 구경할 곳", books: "책 읽을 곳", cafe: "카페에서 쉴 곳", activity: "신나게 놀 곳" };
  const title = activity ? activityTitles[state.interest] : `${state.location.label}에서 둘러볼 곳`;
  const summary = activity
    ? (selection.mode === "nearby"
      ? `직선 30km 이내 ${selection.nearbyCount}곳 · 가까운 순${selection.unlocatedCount ? ` · ${selectedRegion()} 거리 미확인 ${selection.unlocatedCount}곳 별도 포함` : ""}`
      : `${selectedRegion()} 지역 목록 · ${matches.length}곳${selection.unlocatedCount ? ` · 거리 미확인 ${selection.unlocatedCount}곳 포함` : ""}`)
    : `${selectedRegion()} 목록 ${matches.length}곳 · ${hasOrigin ? "대략적인 출발점의 직선거리 가까운 순" : "출발 좌표 확인 전"}. 실제 경로와 운영 여부는 지도에서 확인해 주세요.`;
  const titlePrefix = activity ? { walk: "산책", running: "달리기", exhibition: "전시", books: "책", cafe: "카페", activity: "신나게" }[state.interest] : "";
  const titleHtml = titlePrefix && title.startsWith(titlePrefix) ? `<span>${escapeHtml(titlePrefix)}</span>${escapeHtml(title.slice(titlePrefix.length))}` : escapeHtml(title);
  const nearbyMode = activity && selection.mode === "nearby";
  return `<main class="screen browse-editorial-screen">
    ${header("장소 후보", "back-condition")}
    <section class="browse-editorial__intro"><span class="browse-editorial__memo">모아가 골라봤어요</span><h1 class="browse-editorial__title"><span class="browse-editorial__title-copy">${titleHtml}</span><svg class="browse-editorial__flick" viewBox="0 0 24 28" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" aria-hidden="true"><path d="m6 3-3 9m16-2-7 6m8 7-7 1"/></svg></h1><p class="browse-editorial__summary">${nearbyMode ? "내 주변" : escapeHtml(selectedRegion())}에서 찾은 장소 ${matches.length}곳</p>
      <div class="browse-editorial__controls"><button type="button" class="browse-editorial__region" data-action="open-region" aria-label="지역 변경: ${escapeHtml(selectedRegion())}"><svg viewBox="0 0 100 44" preserveAspectRatio="none" fill="none" aria-hidden="true"><path d="M13 2C38 1 67 3 85 2c10 0 12 6 12 14l-1 13c0 9-4 13-12 13-25 1-48-1-70 0C5 42 3 37 3 29L2 15C2 7 6 3 13 2Z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>${escapeHtml(selectedRegion())} <span aria-hidden="true">⌄</span></button><button type="button" data-action="back-condition">조건 바꾸기</button>${activity ? `<button type="button" class="browse-editorial__nearby" data-action="${hasOrigin ? (state.activityScope === "region" ? "browse-nearby" : "browse-region") : "request-location"}">${hasOrigin && state.activityScope !== "region" ? "지역 전체 보기" : "내 주변 보기"}</button>` : ""}</div>
      <p class="browse-editorial__filters">${activity ? "" : `${escapeHtml(interests[state.interest].label)} · `}${escapeHtml(filterSummary)}</p>${state.discoveryLocationError ? `<p class="browse-editorial__error" role="status">${escapeHtml(state.discoveryLocationError)}</p>` : ""}
    </section>
    <div class="browse-editorial__list-heading"><h2 id="browse-editorial-list-title">추천 장소</h2><span>${matches.length}곳</span></div>
    <section class="browse-editorial__list" aria-labelledby="browse-editorial-list-title">${visible.map((spot, index) => browseEditorialCard(spot, index, hasOrigin)).join("")}</section>
    ${matches.length === 0 ? `<section class="browse-editorial__empty" data-analytics-empty="recommendation"><strong>이 조건에 맞는 장소가 아직 없어요</strong><p>관심사나 지역을 바꿔보거나 전체 목록에서 찾아보세요.</p><div><button type="button" data-action="back-condition">조건 다시 고르기</button><button type="button" data-action="open-search">전체 장소 검색</button></div></section>` : ""}
    ${matches.length > state.browseCount ? `<button type="button" class="browse-editorial__more" data-action="browse-more">더 보기 · ${matches.length - state.browseCount}곳 남음</button>` : ""}
    <aside class="browse-editorial__note"><p>방문 전 운영시간과 입장 조건을 확인해 주세요.</p>${activity && !hasOrigin ? `<p>거리 확인 전인 장소는 지도에서 출발지를 설정해 주세요.</p>` : `<p>${escapeHtml(summary)}</p>`}${nearbyMode && selection.unlocatedCount ? `<p>${escapeHtml(selectedRegion())}의 거리 미확인 장소 ${selection.unlocatedCount}곳도 함께 표시해요.</p>` : ""}${state.companion === "alone" ? `<p>혼자 방문하기 좋은지는 장소 정보를 한 번 더 확인해 주세요.</p>` : ""}</aside>
    ${bottomNav("home")}
  </main>`;
}

function placeAdmissionInfo(spot) {
  const source = spot.classificationSourceUrl || spot.sourceUrl || "";
  const checked = spot.classificationCheckedAt || spot.sourceCheckedAt || "";
  const caveat = spot.classificationStatus === "hold" ? "현재 추천에서 제외된 장소예요." : "";
  return `<div class="route-note">${caveat ? `<p>${escapeHtml(caveat)}</p>` : ""}${spot.availableFrom && spot.availableUntil ? `<p>안내 기간 ${escapeHtml(spot.availableFrom)} ~ ${escapeHtml(spot.availableUntil)}</p>` : ""}<p>${escapeHtml(spot.admissionNote || "운영시간과 입장 조건은 방문 전에 확인해 주세요.")}</p>${/^https?:\/\//.test(source) ? `<a href="${escapeHtml(source)}" target="_blank" rel="noopener noreferrer">공식 이용 안내 ↗</a>` : ""}${checked ? `<small>자료 확인 · ${escapeHtml(checked)}</small>` : ""}</div>`;
}

function shareSheet() {
  return `<div class="sheet-backdrop" data-action="close-share"><section class="share-sheet" role="dialog" aria-modal="true" aria-labelledby="share-title">
    <div class="sheet-handle"></div>${mascot("invite", "medium", "친구를 초대하는 모아")}
    <h2 id="share-title">같이 가면 더 재밌어요</h2><p>장소를 친구에게 보내고 함께 이야기해보세요.</p>
    <button class="share-option is-primary" data-share="recommend"><i>↗</i><span><strong>친구에게 장소 보내기</strong><small>선택한 장소 이름을 공유해요</small></span></button>
    <button class="share-option" data-share="invite"><i>♙</i><span><strong>같이 고르자고 보내기</strong><small>친구에게 함께 탐험하자고 전해요</small></span></button>
    <button class="sheet-close" data-action="close-share">닫기</button>
  </section></div>`;
}

function resultScreen() {
  const detail = transportData[state.transport];
  const spot = allSpots.find((item) => item.id === state.selectedSpotId);
  const backAction = state.resultBack === "search" ? "back-search-results" : state.resultBack === "saved" ? "back-saved" : state.resultBack === "moments" ? "back-moments" : state.resultBack === "home" ? "back-home" : "back-browse";
  const activeTab = state.resultBack === "saved" ? "saved" : state.resultBack === "moments" ? "moments" : "home";
  if (!spot) return `<main class="screen place-detail-screen">${header("장소 정보", backAction)}<section class="place-detail__empty" data-analytics-error="spot_not_found"><h1>장소를 찾지 못했어요</h1><p>하단 메뉴에서 다른 장소를 찾아보세요.</p></section>${bottomNav(activeTab)}</main>`;
  const alternatives = recommendableCatalogSpots.filter((item) => item.region === spot.region && item.id !== spot.id).sort((a, b) => (distanceToSpot(a) ?? Infinity) - (distanceToSpot(b) ?? Infinity)).slice(0, 2);
  const saved = state.savedSpotIds.includes(spot.id);
  const visitCount = state.explorations.filter((item) => item.spotId === spot.id).length;
  const rewardTheme = discoveryRewardForSpot(spot);
  return `<main class="screen place-detail-screen">
    <header class="app-header">
      <div></div>
      <strong>장소 정보</strong>
      <button type="button" class="place-detail__share" data-action="open-share" aria-label="친구에게 공유하기"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3m-4 4 4-4 4 4M7 11H5v10h14V11h-2"/></svg><span>공유</span></button>
    </header>
    <article class="place-detail__intro">
      <p class="place-detail__region">${escapeHtml(spot.region)}${spot.area ? ` · ${escapeHtml(spot.area)}` : ""}</p>
      <div class="place-detail__heading"><h1>${escapeHtml(spot.title)}</h1><button type="button" class="place-detail__save${saved ? " is-saved" : ""}" data-action="toggle-save" aria-label="${saved ? "저장 취소" : "장소 저장"}" aria-pressed="${saved}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 4.8c0-1 .8-1.8 1.8-1.8h7.4c1 0 1.8.8 1.8 1.8V21L12 17.6 6.5 21V4.8Z"/></svg></button></div>
      <p class="place-detail__description">${escapeHtml(spot.desc || spotDescriptions[spot.id] || "")}</p>
      <p class="place-detail__distance">직선거리 <strong>${distanceToSpot(spot) !== null ? `약 ${distanceLabel(distanceToSpot(spot))}` : "확인 전"}</strong></p>
      ${crowdContext(spot, false)}
    </article>
    <section class="place-detail__route" aria-label="길찾기">
      <button type="button" class="place-detail__primary" data-map-link="detail" data-spot-id="${escapeHtml(spot.id)}" aria-haspopup="dialog">${homeSketchFrame("search")}<span>길찾기 · 지도 선택</span><span aria-hidden="true">↗</span></button>
    </section>
    <details class="place-detail__info"><summary>방문 전 확인<span aria-hidden="true">＋</span></summary>
      <div class="place-detail__info-body">
        <section class="place-detail__info-group"><h3>이용 안내</h3>${placeAdmissionInfo(spot)}</section>
        <section class="place-detail__info-group"><h3>추천 기준</h3><p>${escapeHtml(spotReason(spot))}</p><p class="place-detail__info-note">날씨·영업시간은 추천 순위에 반영하지 않아요.</p></section>
        <section class="place-detail__info-group"><h3>거리 안내</h3><p>${distanceToSpot(spot) !== null ? "직선거리 기준으로 가까운 순이에요." : "위치 정보가 부족해 거리순 정렬은 적용되지 않았어요."}</p><p class="place-detail__info-note">실제 이동거리·시간은 지도에서 확인해 주세요.</p></section>
        <section class="place-detail__info-group"><h3>혼잡도 안내</h3><ul><li><strong>서울시 정보</strong><span>주변 지역 기준 · 장소 내부 혼잡도는 아니에요.</span></li><li><strong>예상 정보</strong><span>방문 수요 기반 추정 · 실시간 측정값은 아니에요.</span></li></ul></section>
      </div>
    </details>
    <section class="place-detail__record" aria-label="방문 기록">
      ${visitCount ? `<p class="place-detail__visited" role="status">이 장소의 방문 사진 ${visitCount}장을 기록했어요.</p>` : ""}
      <button type="button" data-action="verify-selected-spot">${rewardTheme ? "도착했어요 · 현장 인증하기" : visitCount ? "방문 사진 더 남기기" : "도착했어요 · 방문 사진 남기기"}<span aria-hidden="true">→</span></button>
      <p>${rewardTheme ? "오늘의 발견 카드는 현장 위치와 사진을 확인해야 받아요." : "사진 기록은 현재 위치를 확인하지 않으며 카드를 지급하지 않아요."}</p>
    </section>
    ${alternatives.length ? `<section class="place-detail__alternatives"><h2>같은 지역의 다른 장소</h2>${alternatives.map((item) => `<button type="button" data-result-spot="${escapeHtml(item.id)}" data-analytics-card="alternative" data-spot-id="${escapeHtml(item.id)}"><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.region)} · ${escapeHtml(item.area || "")}</small></span><span aria-hidden="true">→</span></button>`).join("")}</section>` : ""}
    ${bottomNav(activeTab)}
    ${state.shareOpen ? shareSheet() : ""}
  </main>`;
}

let renderedDetailKey = null;
function render() {
  const app = document.querySelector("#app");
  const detailKey = state.screen === "result" ? state.selectedSpotId : null;
  const resetDetailScroll = detailKey !== null && detailKey !== renderedDetailKey;
  renderedDetailKey = detailKey;
  const analyticsKey = `${state.screen}:${state.screen === "result" ? state.selectedSpotId : ""}`;
  if (analyticsScreen !== analyticsKey) {
    analyticsScreen = analyticsKey;
    analyticsViewId++;
    trackEvent("screen_viewed", { screen: state.screen });
    if (state.screen === "result") trackEvent("place_detail_viewed", { spot_id: state.selectedSpotId, screen: state.screen });
  }
  const screen = state.screen === "home" ? homeScreen()
    : state.screen === "moments" ? momentsScreen()
    : state.screen === "moment-detail" ? momentDetailScreen()
    : state.screen === "liked-moments" ? likedMomentsScreen()
    : state.screen === "visit-history" ? visitHistoryScreen()
    : state.screen === "visit-detail" ? visitDetailScreen()
    : state.screen === "condition" ? conditionScreen()
    : state.screen === "browse" ? browseScreen()
    : state.screen === "result" ? resultScreen()
    : state.screen === "search" ? searchScreen()
    : state.screen === "friends" ? friendsScreen()
    : state.screen === "dogam" ? dogamScreen()
    : state.screen === "map" ? mapScreen()
    : simpleTabScreen(state.screen);
  app.innerHTML = screen + (state.verify.open ? verificationSheet() : "") + (state.regionOpen ? regionSheet() : "") + (state.moaLookSheetOpen ? moaLookSheet() : "") + (state.openDiscoveryCardDate || state.rewardPreviewOpen ? discoveryRewardSheet() : "");
  if (state.mapPickerSpotId) app.insertAdjacentHTML("beforeend", mapPickerSheet());
  if (resetDetailScroll) window.scrollTo({ top: 0, behavior: "auto" });
  if (state.dataError) {
    const notice = document.createElement("p");
    notice.className = "verify-reward-error";
    notice.setAttribute("role", "alert");
    notice.textContent = state.dataError;
    app.querySelector("main")?.prepend(notice);
  }
  if (state.moaLookSheetOpen) {
    const rail = document.querySelector(".moa-look-rail");
    const active = rail?.querySelector(".is-focused");
    if (rail && active) rail.scrollLeft = active.offsetLeft - rail.offsetLeft - (rail.clientWidth - active.clientWidth) / 2;
  }
  observeCrowdContexts();
  observeAnalyticsCards();
  trackVisibleAnalyticsStates();
}

function handleNativeBack(event) {
  // Follow the same modal and return destinations as the existing UI controls.
  if (state.mapPickerSpotId) {
    state.mapPickerSpotId = "";
  } else if (state.openDiscoveryCardDate || state.rewardPreviewOpen) {
    state.openDiscoveryCardDate = "";
    state.rewardPreviewOpen = false;
    state.rewardCardFresh = false;
  } else if (state.moaLookSheetOpen) {
    state.moaLookSheetOpen = false;
  } else if (state.regionOpen) {
    state.regionOpen = false;
    state.pendingHomeDestination = "";
  } else if (state.verify.open) {
    if (state.verify.checking) { event.preventDefault(); return; }
    state.verify.open = false;
  } else if (state.shareOpen) {
    state.shareOpen = false;
  } else {
    const destinations = {
      result: ["search", "saved", "moments", "home", "browse"].includes(state.resultBack) ? state.resultBack : "browse",
      "moment-detail": state.momentDetailBack === "saved" ? "saved" : state.momentDetailBack === "liked-moments" ? "liked-moments" : "moments",
      browse: state.browseEntryScreen === "home" ? "home" : "condition",
      condition: "home", search: "home", "liked-moments": "my",
      dogam: "my", map: "my", friends: "home",
      "visit-history": "my", "visit-detail": state.visitDetailBack,
      moments: "home", saved: "home", my: "home",
    };
    const destination = destinations[state.screen];
    if (!destination) return; // Home: the bridge requests mini-app exit.
    state.screen = destination;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }
  event.preventDefault();
  render();
}

window.addEventListener("today-mwohaji:native-back", handleNativeBack);
window.addEventListener("today-mwohaji:native-back-error", () => {
  state.dataError = "토스 뒤로가기를 연결하지 못했어요. 하단 탭으로 이동하거나 앱을 다시 열어 주세요.";
  render();
});

function visiblePosition(node, selector) {
  const nodes = [...document.querySelectorAll(selector)].filter((item) => !item.hidden && item.getClientRects().length > 0);
  const index = nodes.indexOf(node);
  return index >= 0 ? index + 1 : null;
}

function observeAnalyticsCards() {
  analyticsCardObserver?.disconnect();
  const cards = [...document.querySelectorAll("[data-analytics-card]")];
  const record = (card) => {
    const surface = card.dataset.analyticsCard;
    const spotId = card.dataset.spotId;
    if (!surface || !spotId || card.hidden || card.getClientRects().length === 0) return;
    const position = visiblePosition(card, `[data-analytics-card="${surface}"]`);
    trackStateOnce("recommendation_impression", `card:${surface}:${spotId}`, {
      spot_id: spotId,
      result_position: position,
      card_surface: surface,
      screen: state.screen,
    });
  };
  if (!("IntersectionObserver" in window)) {
    cards.forEach(record);
    return;
  }
  analyticsCardObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting || entry.intersectionRatio < 0.5) return;
      record(entry.target);
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.5 });
  cards.forEach((card) => analyticsCardObserver.observe(card));
}

function trackVisibleAnalyticsStates() {
  if (state.screen === "condition") trackStateOnce("recommendation_step_viewed", "preferences", { step: "preferences", screen: state.screen });
  if (state.regionOpen && state.screen === "condition") trackStateOnce("recommendation_step_viewed", "region", { step: "region", screen: state.screen });
  if (state.screen === "browse") trackStateOnce("recommendation_results_viewed", state.interest + ":" + selectedRegion() + ":" + state.companion + ":" + state.activityScope, { activity: state.interest, result_count: browseCandidates().length, screen: state.screen });
  if (state.screen === "home") {
    const { theme, collected } = todayDiscovery();
    trackStateOnce("daily_discovery_presented", "home-card", {
      theme_id: theme?.id || null,
      already_collected: collected,
      region_confirmed: state.location.source === "gps" || state.discoveryManualReady,
      total_cards: state.discoveryRecords.length,
      selected_region: selectedRegion(),
    });
  }
  document.querySelectorAll("[data-analytics-empty]").forEach((node) => {
    if (node.hidden || node.getClientRects().length === 0) return;
    const context = node.dataset.analyticsEmpty;
    trackStateOnce("empty_result_viewed", `empty:${context}`, {
      empty_context: context,
      screen: state.screen,
      selected_region: selectedRegion(),
      interest: state.interest,
      companion: state.companion,
    });
  });
  document.querySelectorAll("[data-analytics-error]").forEach((node) => {
    if (node.hidden || node.getClientRects().length === 0) return;
    const errorType = node.dataset.analyticsError;
    trackStateOnce("error_viewed", `error:${errorType}`, {
      error_type: errorType,
      screen: state.screen,
    });
  });
}

document.addEventListener("keydown", (event) => {
  if (state.mapPickerSpotId) {
    if (event.key === "Escape") {
      event.preventDefault();
      state.mapPickerSpotId = "";
      render();
      document.querySelector("[data-map-link]")?.focus({ preventScroll: true });
    } else if (event.key === "Tab") {
      const items = [...document.querySelectorAll(".map-picker a, .map-picker button")];
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    return;
  }
  if (!event.target.closest('[data-saved-tab]') || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  state.savedTab = event.key === "Home" ? "places" : event.key === "End" ? "moments" : state.savedTab === "moments" ? "places" : "moments";
  render();
  document.getElementById(`saved-tab-${state.savedTab}`)?.focus({ preventScroll: true });
});

document.addEventListener("click", async (event) => {
  if (event.target.closest("[data-close-map-picker]") || event.target.classList.contains("map-picker-backdrop")) {
    state.mapPickerSpotId = "";
    render();
    document.querySelector("[data-map-link]")?.focus({ preventScroll: true });
    return;
  }
  if (event.target.closest("[data-map-provider]")) return;
  if (event.target.closest("[data-copy-map-place]")) {
    const spot = allSpots.find(item => item.id === state.mapPickerSpotId);
    const status = document.querySelector(".map-picker__status");
    if (!spot) return;
    const text = [spot.title, spot.address || spot.searchQuery || [spot.region, spot.area].filter(Boolean).join(" ")].filter(Boolean).join("\n");
    try { await navigator.clipboard.writeText(text); status.textContent = "장소 정보를 복사했어요."; }
    catch { status.textContent = `복사하지 못했어요. 아래 정보를 길게 눌러 복사해 주세요. ${text}`; }
    return;
  }
  const mapLink = event.target.closest("[data-map-link]");
  if (mapLink) {
    event.preventDefault();
    if (!allSpots.some(spot => spot.id === mapLink.dataset.spotId)) return;
    state.mapPickerSpotId = mapLink.dataset.spotId;
    const surface = mapLink.dataset.mapLink;
    const position = surface === "recommendation"
      ? visiblePosition(mapLink.closest("[data-analytics-card]"), '[data-analytics-card="recommendation"]')
      : null;
    trackEvent("map_link_clicked", {
      spot_id: mapLink.dataset.spotId,
      result_position: position,
      link_surface: surface,
      screen: state.screen,
    });
    render();
    document.querySelector("[data-map-provider]")?.focus({ preventScroll: true });
    return;
  }
  const selectedOrigin = event.target.closest("[data-origin-result]");
  if (selectedOrigin) {
    const item = state.originLookup.results[Number(selectedOrigin.dataset.originResult)];
    if (item && hasCoords(item) && regions.some((region) => normalizedRegion(region) === item.region)) {
      saveLocation({ label: item.label, region: item.region, source: "selected", coords: { lat: item.lat, lng: item.lng } });
      state.originLookup = { query: "", status: "idle", results: [], message: "" };
      state.regionOpen = false;
      render();
    }
    return;
  }
  if (event.target.closest('[data-action="save-manual-origin"]')) {
    const form = document.querySelector("#origin-form");
    const label = form?.elements.namedItem("origin")?.value.trim();
    const region = form?.elements.namedItem("region")?.value;
    if (!label) { form?.elements.namedItem("origin")?.focus(); return; }
    if (!regions.includes(region)) return;
    saveLocation({ label, region, source: "manual" });
    state.originLookup = { query: "", status: "idle", results: [], message: "" };
    state.regionOpen = false;
    render();
    return;
  }
  if (event.target.closest('[data-action="save-region-only"]')) {
    const regionLabel = document.querySelector("#origin-region")?.value;
    if (!regions.includes(regionLabel)) return;
    saveLocation({ label: regionLabel, region: normalizedRegion(regionLabel), source: "manual" });
    state.originLookup = { query: "", status: "idle", results: [], message: "" };
    state.regionOpen = false;
    render();
    return;
  }
  if (event.target.closest("#origin-form")) return;
  const visitAddressResult = event.target.closest("[data-visit-address-result]");
  if (visitAddressResult && state.verify.custom) {
    const item = state.verify.addressLookup.results[Number(visitAddressResult.dataset.visitAddressResult)];
    if (item && hasCoords(item) && item.address?.trim()) {
      state.verify.address = item.address.trim();
      state.verify.addressCoords = { lat: item.lat, lng: item.lng };
      state.verify.region = item.region;
      state.verify.addressLookup = { status: "selected", results: [], message: "주소를 선택했어요. 사진과 함께 기록할 수 있어요." };
      render();
    }
    return;
  }
  if (event.target.closest('[data-action="search-visit-address"]')) {
    await searchVisitAddress();
    return;
  }
  if (event.target.closest(".share-sheet") && !event.target.closest("button")) return;
  if (event.target.closest(".region-sheet") && !event.target.closest("button")) return;
  if (event.target.closest(".verify-sheet") && !event.target.closest("button")) return;
  if (event.target.closest(".moa-look-sheet") && !event.target.closest("button")) return;
  if (event.target.closest(".discovery-reward-sheet") && !event.target.closest("button")) return;
  const target = event.target.closest("button, [data-action]");
  if (!target) return;
  if (target.dataset.savedTab) {
    state.savedTab = target.dataset.savedTab === "moments" ? "moments" : "places";
    render();
    document.getElementById(`saved-tab-${state.savedTab}`)?.focus({ preventScroll: true });
    return;
  }
  if (target.dataset.momentSort) {
    state.momentSort = target.dataset.momentSort === "popular" ? "popular" : "latest";
    render();
    return;
  }
  if (target.dataset.momentDetail) {
    const moment = momentById(target.dataset.momentDetail);
    if (!moment) return;
    state.selectedMomentId = moment.id;
    state.momentDetailBack = state.screen === "liked-moments" ? "liked-moments" : "moments";
    state.screen = "moment-detail";
    render();
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    return;
  }
  if (target.dataset.mapProvider) {
    const moment = momentById(state.selectedMomentId);
    if (!moment) return;
    try {
      await openMomentMap(moment, target.dataset.mapProvider);
    } catch {
      target.setAttribute("aria-label", "지도를 열지 못했어요. 다시 시도해 주세요");
    }
    return;
  }
  if (state.screen === "home" && state.location.source === "pilot" && target.dataset.action === "open-search") {
    state.pendingHomeDestination = "search";
    state.regionOpen = true;
    render();
    return;
  }
  if (target.dataset.discoveryCardDate) {
    if (state.discoveryRecords.some((item) => item.date === target.dataset.discoveryCardDate)) {
      state.openDiscoveryCardDate = target.dataset.discoveryCardDate;
      state.rewardCardFresh = false;
      render();
    }
    return;
  }
  if (target.dataset.action === "preview-discovery-card") {
    state.rewardPreviewOpen = true;
    render();
    return;
  }
  if (target.dataset.action === "close-discovery-card") {
    state.openDiscoveryCardDate = "";
    state.rewardCardFresh = false;
    state.rewardPreviewOpen = false;
    render();
    return;
  }
  if (target.dataset.lookLevel) {
    state.moaLookLevel = Number(target.dataset.lookLevel);
    render();
    return;
  }
  if (target.dataset.action === "open-moa-looks") {
    state.moaLookLevel = activeMoaLook().level;
    state.moaLookSheetOpen = true;
    render();
    return;
  }
  if (target.dataset.action === "toggle-ga-consent") {
    if (!window.MoaAnalytics) return;
    window.MoaAnalytics.setEnabled(!window.MoaAnalytics.enabled());
    if (window.MoaAnalytics.enabled()) trackEvent("screen_viewed", { screen: state.screen });
    render();
    document.querySelector('.my-analytics-settings')?.setAttribute('open', '');
    return;
  }
  if (target.dataset.action === "close-moa-looks") {
    state.moaLookSheetOpen = false;
    render();
    return;
  }
  if (target.dataset.action === "apply-moa-look") {
    const look = moaLooks.find((item) => item.level === state.moaLookLevel);
    if (look && moaLookUnlocked(look)) {
      state.moaLook = look.id;
      try { localStorage.setItem(MOA_LOOK_STORAGE_KEY, look.id); } catch { /* 저장소가 막혀도 현재 화면에는 적용해요. */ }
      state.moaLookSheetOpen = false;
      try { await persistPreferences(); } catch { state.dataError = "선택을 저장하지 못했어요. 다시 선택해 주세요."; }
      render();
    }
    return;
  }
  if (target.dataset.action === "open-discovery-book") {
    state.openDiscoveryCardDate = "";
    state.rewardCardFresh = false;
    state.rewardPreviewOpen = false;
    state.screen = "my";
    render();
    document.querySelector(".discovery-book")?.scrollIntoView({ block: "start" });
    return;
  }
  if (target.dataset.action === "find-discovery-nearby") {
    requestCurrentLocation();
    return;
  }
  if (target.dataset.action === "use-discovery-region") {
    state.discoveryManualReady = true;
    state.discoveryLocationError = "";
    render();
    return;
  }
  if (target.dataset.action === "open-discovery-candidate") {
    const { theme, collected } = todayDiscovery();
    const saved = collected ? state.discoveryRecords.find((item) => item.date === localDateKey()) : null;
    const candidate = saved?.region === selectedRegion() ? catalogSpots.find((spot) => spot.id === saved.spotId) || discoveryCandidate(theme) : discoveryCandidate(theme);
    if (candidate) {
      state.selectedSpotId = candidate.id;
      state.resultBack = "home";
      state.screen = "result";
      trackEvent("daily_discovery_explore_clicked", { theme_id: theme?.id || null, spot_id: candidate.id, screen: "result" });
    } else {
      state.screen = "search";
    }
    render();
    return;
  }
  if (target.dataset.discoveryTheme) {
    const theme = discoveryThemeById(target.dataset.discoveryTheme);
    if (theme) {
      const hasMatches = recommendableCatalogSpots.some((spot) => spot.region === selectedRegion() && discoveryMatches(spot, theme));
      state.interest = theme.interest;
      state.companion = "any";
      state.browseCount = 12;
      state.selectedSpotId = "";
      state.resultBack = "browse";
      state.screen = hasMatches ? "browse" : "search";
      trackEvent("daily_discovery_explore_clicked", { theme_id: theme.id, related_spots_available: hasMatches, screen: state.screen });
      render();
      return;
    }
  }
  const selection = target.dataset.browseSpot
    ? { spotId: target.dataset.browseSpot, surface: "recommendation", selector: '[data-analytics-card="recommendation"]' }
    : target.dataset.searchSpot
      ? { spotId: target.dataset.searchSpot, surface: "search", selector: '[data-analytics-card="search"]' }
      : target.dataset.savedSpot
        ? { spotId: target.dataset.savedSpot, surface: "saved", selector: '[data-analytics-card="saved"]' }
        : target.dataset.resultSpot
          ? { spotId: target.dataset.resultSpot, surface: "alternative", selector: '[data-analytics-card="alternative"]' }
          : null;
  if (selection) {
    trackEvent("experience_selected", {
      spot_id: selection.spotId,
      result_position: visiblePosition(target.closest("[data-analytics-card]"), selection.selector),
      selection_surface: selection.surface,
      screen: state.screen,
    });
  }
  if (target.dataset.transport) state.transport = target.dataset.transport;
  if (target.dataset.interest) {
    state.interestChosen = true;
    state.interest = target.dataset.interest;
    trackEvent("activity_selected", { activity: state.interest, screen: state.screen });
  }
  if (target.dataset.companion) {
    state.companion = target.dataset.companion;
    trackEvent("companion_selected", { companion: state.companion, screen: state.screen });
  }
  if (target.dataset.interest || target.dataset.companion) state.browseCount = 12;
  const navigatedByTab = Boolean(target.dataset.tab);
  if (navigatedByTab) {
    trackEvent("tab_selected", { screen: target.dataset.tab });
    state.screen = target.dataset.tab;
  }
  if (target.dataset.homeSpot) {
    state.selectedSpotId = target.dataset.homeSpot;
    state.resultBack = state.screen;
    state.screen = "result";
  }
  if (target.dataset.visitDetail) {
    state.visitDetailBack = state.screen === "visit-history" ? "visit-history" : "my";
    state.selectedVisitId = target.dataset.visitDetail;
    state.screen = "visit-detail";
    window.scrollTo(0, 0);
  }
  if (target.dataset.action === "more-visits") state.visitListLimit += 12;
  if (target.dataset.screen) {
    state.screen = target.dataset.screen;
    if (state.screen === "visit-history") window.scrollTo(0, 0);
  }
  if (target.dataset.mapRegion) state.mapRegion = target.dataset.mapRegion;
  if (target.dataset.searchSpot) {
    state.selectedSpotId = target.dataset.searchSpot;
    state.resultBack = "search";
    state.screen = "result";
  }
  if (target.dataset.browseSpot) {
    state.selectedSpotId = target.dataset.browseSpot;
    state.resultBack = "browse";
    state.screen = "result";
  }
  if (target.dataset.savedSpot) {
    state.selectedSpotId = target.dataset.savedSpot;
    state.resultBack = "saved";
    state.screen = "result";
  }
  if (target.dataset.savedMoment) {
    state.selectedMomentId = target.dataset.savedMoment;
    state.momentDetailBack = "saved";
    state.screen = "moment-detail";
    render();
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    return;
  }
  if (target.dataset.resultSpot) state.selectedSpotId = target.dataset.resultSpot;
  if (target.dataset.action === "select-pilot-location") {
    // Retired prototype action must not set a fake or private origin.
    return;
  }
  if (target.dataset.verifyPlace) {
    state.verify.description = "";
    state.verify.isPublic = false;
    state.verify.address = "";
    state.verify.addressCoords = null;
    state.verify.addressLookup = { status: "idle", results: [], message: "" };
    state.verify.custom = target.dataset.verifyPlace === "직접 선택한 장소";
    state.verify.place = state.verify.custom ? "" : target.dataset.verifyPlace;
    const spot = dogamSpots.find((item) => item.title === state.verify.place);
    state.verify.spotId = spot?.id || "";
    state.verify.region = spot?.region || (state.verify.custom ? "" : selectedRegion());
    state.verify.step = "photo";
  }
  if (target.dataset.verifySpotId) {
    trackEvent("verification_started", { screen: state.screen });
    const spot = allSpots.find((item) => item.id === target.dataset.verifySpotId);
    if (spot) state.verify = createVisitVerification({ open: true, step: "photo", place: spot.title, photo: "", spotId: spot.id, region: spot.region, custom: false });
  }
  if (target.dataset.dogamSpotId) {
    trackEvent("verification_started", { screen: state.screen });
    const spot = dogamCatalogSpots.find((item) => item.id === target.dataset.dogamSpotId);
    if (spot) state.verify = createVisitVerification({ open: true, step: "photo", place: spot.title, photo: "", spotId: spot.id, region: spot.region, custom: false });
  }
  if (target.dataset.dogamRegion) {
    const region = target.dataset.dogamRegion;
    state.dogamExpandedRegions = state.dogamExpandedRegions.includes(region)
      ? state.dogamExpandedRegions.filter((item) => item !== region)
      : [...state.dogamExpandedRegions, region];
  }
  if (target.dataset.action === "show-result") trackEvent("recommendation_step_completed", { step: "preferences", screen: state.screen });
  if (target.dataset.action === "show-result" && state.location.source === "pilot") {
    state.browseEntryScreen = "condition";
    state.browseCount = 12;
    state.pendingHomeDestination = "browse";
    state.regionOpen = true;
    render();
    return;
  }
  const actions = { start: "condition", "back-home": "home", "back-moments": "moments", "back-liked-moments": "liked-moments", "show-result": "browse", "back-condition": state.browseEntryScreen, "back-browse": "browse", "back-search-results": "search", "back-saved": "saved", "open-search": "search", "back-search": "home", "back-my": "my" };
  if (actions[target.dataset.action]) state.screen = actions[target.dataset.action];
  if (target.dataset.action === "start" || target.dataset.action === "show-result") {
    if (target.dataset.action === "start") trackEvent("recommendation_started", { screen: state.screen });
    state.selectedSpotId = "";
    state.resultBack = "browse";
  }
  if (target.dataset.action === "show-result") {
    state.browseEntryScreen = "condition";
    state.browseCount = 12;
    state.activityScope = "nearby";
  }
  if (target.dataset.action === "start") window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  if (target.dataset.action === "browse-more") state.browseCount += 12;
  if (["browse-region", "browse-nearby"].includes(target.dataset.action)) {
    state.activityScope = target.dataset.action === "browse-region" ? "region" : "nearby";
    state.browseCount = 12;
  }
  if (target.dataset.action === "change-region-from-result") {
    state.screen = "home";
    state.regionOpen = true;
  }
  if (target.dataset.action === "toggle-save") {
    target.disabled = true;
    const id = state.selectedSpotId;
    const previous = state.savedSpotIds;
    if (id) state.savedSpotIds = previous.includes(id) ? previous.filter((savedId) => savedId !== id) : [...previous, id];
    try {
      await persistPreferences();
      trackEvent(previous.includes(id) ? "place_unsave_completed" : "place_save_completed", { spot_id: id, screen: state.screen });
    } catch { state.savedSpotIds = previous; trackEvent("place_save_failed", { failure_reason: "persistence_failed" }); window.alert("저장하지 못했어요. 다시 시도해 주세요."); }
  }
  if (target.dataset.momentSave) {
    target.disabled = true;
    const id = target.dataset.momentSave;
    const previous = state.savedMomentIds;
    state.savedMomentIds = state.savedMomentIds.includes(id)
      ? state.savedMomentIds.filter((savedId) => savedId !== id)
      : [...state.savedMomentIds, id];
    try {
      await persistPreferences();
      trackEvent(previous.includes(id) ? "moment_unsave_completed" : "moment_save_completed", { screen: state.screen });
    } catch { state.savedMomentIds = previous; trackEvent("moment_save_failed", { failure_reason: "persistence_failed" }); window.alert("저장하지 못했어요. 다시 시도해 주세요."); }
  }
  if (target.dataset.momentLike) {
    target.disabled = true;
    const id = target.dataset.momentLike;
    const previous = state.likedMomentIds;
    state.likedMomentIds = state.likedMomentIds.includes(id)
      ? state.likedMomentIds.filter((likedId) => likedId !== id)
      : [...state.likedMomentIds, id];
    try {
      if (!window.MoaData) throw new Error("unavailable");
      state.likeTotals[id] = await window.MoaData.setLike(id, state.likedMomentIds.includes(id));
      trackEvent(previous.includes(id) ? "moment_unlike_completed" : "moment_like_completed", { screen: state.screen });
    } catch { state.likedMomentIds = previous; trackEvent("moment_like_failed", { failure_reason: "persistence_failed" }); window.alert("좋아요를 저장하지 못했어요. 다시 시도해 주세요."); }
  }
  if (target.dataset.visitPublic) {
    const item = state.explorations.find(record => record.id === target.dataset.visitPublic);
    if (!item || (item.isPublic !== true && !window.confirm("사진·한 줄·장소 주소가 다른 사람에게 공개돼요. 공개할까요?"))) return;
    target.disabled = true;
    try { await window.MoaData.setPublic(item.id, !item.isPublic); await refreshCloudData(); }
    catch { window.alert("공개 상태를 변경하지 못했어요. 다시 시도해 주세요."); }
  }
  if (target.dataset.visitDelete) {
    const item = state.explorations.find(record => record.id === target.dataset.visitDelete);
    if (!item || !window.confirm("이 사진과 기록을 삭제할까요? 삭제 후에는 복구할 수 없어요.")) return;
    target.disabled = true;
    try { await window.MoaData.deleteVisit(item.id); await refreshCloudData(); }
    catch { window.alert("삭제하지 못했어요. 다시 시도해 주세요."); }
  }
  if (target.dataset.momentReport) {
    const reason = window.prompt("신고 사유를 적어 주세요. 개인정보·부적절한 사진·잘못된 장소 등을 알려주세요.");
    if (!reason?.trim()) return;
    target.disabled = true;
    try { await window.MoaData.report(target.dataset.momentReport, reason.trim().slice(0, 300)); window.alert("신고를 접수했어요."); }
    catch { window.alert("신고를 접수하지 못했어요. 다시 시도해 주세요."); }
  }
  if (target.dataset.action === "open-share") { state.shareOpen = true; trackEvent("share_clicked", { screen: state.screen }); }
  if (target.dataset.action === "close-share") state.shareOpen = false;
  if (target.dataset.action === "open-region") state.regionOpen = true;
  if (target.dataset.action === "close-region") {
    state.regionOpen = false;
    state.pendingHomeDestination = "";
  }
  if (target.dataset.action === "dismiss-home-location-gate") {
    state.homeLocationGateDismissed = true;
    try { sessionStorage.setItem(HOME_LOCATION_GATE_DISMISSED_KEY, "1"); } catch { /* 다음 화면 전환까지는 현재 상태를 유지해요. */ }
  }
  if (target.dataset.action === "request-location") {
    state.regionOpen = false;
    requestCurrentLocation();
  }
  if (target.dataset.action === "open-verify") {
    trackEvent("verification_started", { screen: state.screen });
    state.selectedSpotId = "";
    state.verify = createVisitVerification({ open: true, step: "place", place: "", photo: "", spotId: "", region: "", custom: false });
  }
  if (target.dataset.action === "search-verify-place") {
    state.selectedSpotId = "";
    state.verify.open = false;
    state.screen = "search";
  }
  if (target.dataset.action === "verify-selected-spot") {
    trackEvent("verification_started", { screen: state.screen });
    const spot = allSpots.find((item) => item.id === state.selectedSpotId);
    if (spot) state.verify = createVisitVerification({ open: true, step: "photo", place: spot.title, photo: "", spotId: spot.id, region: spot.region, custom: false });
  }
  if (target.dataset.action === "close-verify") state.verify.open = false;
  if (target.dataset.action === "verify-back") state.verify.step = "place";
  if (target.dataset.action === "clear-map-region") state.mapRegion = "";
  if (["complete-verify", "record-photo-only"].includes(target.dataset.action) && !state.verify.place.trim()) {
    document.querySelector("#verify-place-name")?.focus();
    return;
  }
  if (["complete-verify", "record-photo-only"].includes(target.dataset.action) && state.verify.custom && !state.verify.address.trim()) {
    document.querySelector("#verify-address")?.focus();
    return;
  }
  if (target.dataset.action === "record-photo-only" && state.verify.photo && state.verify.place.trim()) {
    await persistVisitPhoto();
    render();
    return;
  }
  if (target.dataset.action === "complete-verify" && state.verify.photo && state.verify.place.trim()) {
    const spot = allSpots.find((item) => item.id === state.verify.spotId);
    const theme = !state.verify.custom ? discoveryRewardForSpot(spot) : null;
    if (theme) {
      if (!window.MoaLocation) {
        trackEvent("verification_failed", { failure_reason: "location_unavailable" });
        state.verify.error = "이 기기에서는 현재 위치를 확인할 수 없어 카드를 받을 수 없어요.";
        render();
        return;
      }
      state.verify.checking = true;
      state.verify.error = "";
      render();
      try {
        const position = await window.MoaLocation.getCurrent({ precise: true, maximumAge: 0, timeout: 12000 });
        if (!state.verify.open || state.verify.spotId !== spot.id) return;
        const point = { lat: position.coords.latitude, lng: position.coords.longitude };
        const distance = distanceToSpot(spot, point);
        if (!hasCoords(point) || !Number.isFinite(position.coords.accuracy) || position.coords.accuracy > 100 ||
            !Number.isFinite(position.timestamp) || Math.abs(Date.now() - position.timestamp) > 90000) {
          throw new Error("현재 위치의 정확도가 낮아요. 장소에서 위치를 다시 확인해 주세요.");
        }
        if (distance === null || distance > 0.3) throw new Error("선택한 장소에서 300m 이내일 때 카드를 받을 수 있어요.");
        if (!discoveryRewardForSpot(spot)) throw new Error("오늘의 카드는 이미 받았거나 추천 조건이 바뀌었어요.");
        state.verify.checking = false;
        if (!await persistVisitPhoto()) return;
        awardDiscoveryCard(spot, theme);
        try { await persistPreferences(); } catch { state.dataError = "카드 동기화에 실패했어요. 이 기기에는 기록이 남아 있어요."; }
        state.openDiscoveryCardDate = localDateKey();
        state.rewardCardFresh = true;
        state.screen = "home";
        render();
        return;
      } catch (error) {
        if (!state.verify.open || state.verify.spotId !== spot.id) return;
        trackEvent("verification_failed", { failure_reason: "location_or_eligibility_check_failed" });
        const knownError = error instanceof Error && ["선택한 장소", "현재 위치의 정확도", "오늘의 카드"].some((prefix) => error.message.startsWith(prefix));
        state.verify.error = knownError ? error.message : "위치 권한이 없거나 확인 시간이 초과됐어요. 현장에서 다시 시도해 주세요.";
        state.verify.checking = false;
        render();
        return;
      }
    }
    await persistVisitPhoto();
  }
  if (target.dataset.share) {
    const spot = allSpots.find((item) => item.id === state.selectedSpotId);
    const text = target.dataset.share === "recommend" && spot ? `오늘 여기 어때? ${spot.title} (${spot.region} · ${spot.area})` : "오늘 뭐하지에서 같이 갈 곳 골라보자!";
    try {
      if (navigator.share) await navigator.share({ title: "오늘 뭐하지", text }); else await navigator.clipboard.writeText(text);
      trackEvent("share_completed", { method: navigator.share ? "native_share" : "clipboard" });
    } catch { return; }
    state.shareOpen = false;
  }
  render();
  if (state.screen === "moments" && state.focusMomentId) {
    const id = state.focusMomentId;
    state.focusMomentId = "";
    requestAnimationFrame(() => document.querySelector(`[data-moment-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "start" }));
  }
  if (navigatedByTab || (state.screen === "browse" && ["show-result", "back-browse", "browse-nearby", "browse-region"].includes(target.dataset.action))) window.scrollTo({ top: 0, left: 0, behavior: "instant" });
});

document.addEventListener("submit", async (event) => {
  if (event.target.id !== "origin-form") return;
  event.preventDefault();
  const originInput = event.target.elements.namedItem("origin");
  const regionInput = event.target.elements.namedItem("region");
  const label = originInput.value.trim();
  const region = regionInput.value;
  if (!label) { originInput.focus(); return; }
  if (location.protocol === "file:") {
    if (!regions.includes(region)) return;
    saveLocation({ label, region, source: "manual" });
    state.originLookup = { query: "", status: "idle", results: [], message: "" };
    state.regionOpen = false;
    render();
    return;
  }
  state.originLookup = { query: label, status: "loading", results: [], message: "" };
  render();
  try {
    const response = await fetch(`/api/origins?query=${encodeURIComponent(label)}`);
    const data = await response.json();
    if (state.originLookup.query !== label) return;
    const results = Array.isArray(data.results) ? data.results.filter((item) => hasCoords(item) && regions.some((candidate) => normalizedRegion(candidate) === item.region)) : [];
    state.originLookup = { query: label, status: response.ok ? "ready" : "error", results, message: response.ok ? (results.length ? "아래에서 정확한 출발지를 선택해 주세요." : "검색 결과가 없어요. 다른 이름을 입력하거나 지역만 설정해 주세요.") : (data.error || "검색할 수 없어요. 잠시 후 다시 시도해 주세요.") };
  } catch {
    state.originLookup = { query: label, status: "error", results: [], message: "검색 서버에 연결하지 못했어요. 아래에서 지역만 설정할 수 있어요." };
  }
  render();
});

document.addEventListener("input", (event) => {
  if (event.target.id === "verify-address") {
    state.verify.address = event.target.value;
    state.verify.addressCoords = null;
    state.verify.region = visitAddressRegion(event.target.value);
    state.verify.addressLookup = { status: "idle", results: [], message: "" };
    document.querySelectorAll(".verify-address__results, .verify-address__feedback").forEach((element) => element.remove());
    const searchButton = document.querySelector('[data-action="search-visit-address"]');
    if (searchButton) { searchButton.disabled = false; searchButton.textContent = "주소 검색"; }
    document.querySelectorAll('[data-action="complete-verify"], [data-action="record-photo-only"]').forEach((button) => { button.disabled = !visitPhotoReady() || Boolean(state.verify.checking); });
    return;
  }
  if (event.target.id === "verify-description") {
    state.verify.description = event.target.value.slice(0, 100);
    return;
  }
  if (event.target.id === "verify-place-name") {
    state.verify.place = event.target.value;
    document.querySelectorAll('[data-action="complete-verify"], [data-action="record-photo-only"]').forEach((button) => { button.disabled = !visitPhotoReady() || Boolean(state.verify.checking); });
    return;
  }
  if (event.target.id !== "place-search") return;
  const query = event.target.value.trim().toLowerCase();
  const region = selectedRegion();
  const rows = [...document.querySelectorAll("[data-spot-search]")];
  rows.forEach((row) => { row.hidden = query ? !row.dataset.spotSearch.toLowerCase().includes(query) : row.dataset.spotRegion !== region; });
  const hasResults = rows.some((row) => !row.hidden);
  const empty = document.querySelector(".search-empty");
  empty.hidden = hasResults;
  empty.querySelector("strong").textContent = query ? "검색 결과가 없어요" : "이 지역의 장소는 아직 준비 중이에요";
  empty.querySelector("span").textContent = query ? "다른 지역이나 장소 이름으로 찾아보세요." : "지역을 바꾸거나 다른 장소를 검색해보세요.";
  empty.dataset.analyticsEmpty = query ? "search_query" : "search_region";
  document.querySelector("#search-results-title").textContent = query ? "검색 결과" : `${region} 장소 목록`;
  document.querySelector("#search-results-scope").textContent = query ? "전 지역에서 찾았어요" : "운영 여부는 방문 전 확인";
  trackVisibleAnalyticsStates();
});

document.addEventListener("change", (event) => {
  if (event.target.id === "verify-is-public") {
    state.verify.isPublic = event.target.checked;
    return;
  }
  if (!["verify-camera-input", "verify-album-input"].includes(event.target.id)) return;
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    state.verify.error = "사진 파일만 선택할 수 있어요.";
    render();
    return;
  }
  if (file.size > 20 * 1024 * 1024) {
    state.verify.error = "20MB 이하 사진을 선택해 주세요.";
    render();
    return;
  }
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    state.verify.photo = String(reader.result);
    state.verify.error = "";
    trackEvent("photo_selected", { photo_source: event.target.id === "verify-camera-input" ? "camera" : "album" });
    render();
  });
  reader.readAsDataURL(file);
});

document.addEventListener("click", async event => {
  const source = event.target.closest?.(".verify-source-button");
  if (!source || !window.MoaNativePhoto) return;
  event.preventDefault();
  event.stopPropagation();
  const draft = state.verify;
  if (draft.checking) return;
  try {
    const photo = await window.MoaNativePhoto(Boolean(source.querySelector("#verify-camera-input")));
    if (state.verify === draft && photo) {
      draft.photo = photo; draft.error = "";
      trackEvent("photo_selected", { photo_source: source.querySelector("#verify-camera-input") ? "camera" : "album" });
      render();
    }
  } catch {
    if (state.verify === draft) { draft.error = "사진 선택이 취소됐거나 권한이 없어요. 다시 선택해 주세요."; render(); }
  }
}, true);

document.addEventListener("click", (event) => {
  const term = event.target.closest("[data-search-term]");
  if (term) {
    const input = document.querySelector("#place-search");
    input.value = term.dataset.searchTerm;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
  }
  if (event.target.closest("[data-clear-search]")) {
    const input = document.querySelector("#place-search");
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
  }
});

let locationRequestId = 0;
function requestCurrentLocation() {
  if (state.location.source === "loading") return;
  trackEvent("location_requested", { screen: state.screen });
  if (!window.MoaLocation) {
    trackEvent("location_failed", { failure_reason: "location_unavailable" });
    state.pendingHomeDestination = "";
    state.discoveryLocationError = "이 브라우저에서는 현재 위치를 사용할 수 없어요. 지역을 직접 선택해 주세요.";
    render();
    return;
  }
  const requestId = ++locationRequestId;
  const previousLocation = state.location;
  state.discoveryManualReady = false;
  state.discoveryLocationError = "";
  state.location = { label: "위치 확인 중", region: previousLocation.region, source: "loading" };
  render();
  window.MoaLocation.getCurrent({ precise: false, timeout: 10000, maximumAge: 0 })
    .then(async ({ coords }) => {
      if (requestId !== locationRequestId || state.location.source !== "loading") return;
      const point = { lat: coords.latitude, lng: coords.longitude };
      if (!hasCoords(point) || !Number.isFinite(coords.accuracy) || coords.accuracy > 3000) {
        trackEvent("location_failed", { failure_reason: "insufficient_accuracy" });
        state.pendingHomeDestination = "";
        state.location = previousLocation.source === "gps" ? { ...previousLocation, source: "gps-stale" } : previousLocation;
        state.discoveryLocationError = "위치 정확도가 낮아요. 다시 시도하거나 지역을 직접 선택해 주세요.";
        render();
        return;
      }
      try {
        const response = await fetch(`/api/location-region?lat=${encodeURIComponent(point.lat)}&lng=${encodeURIComponent(point.lng)}`);
        const data = await response.json();
        if (requestId !== locationRequestId || state.location.source !== "loading") return;
        if (!response.ok || !regions.some((region) => normalizedRegion(region) === data.region)) throw new Error(data.error || "지역을 확인하지 못했어요.");
        state.location = { label: data.label, region: data.region, source: "gps", coords: point, accuracy: coords.accuracy };
        trackEvent("location_completed", { location_source: "gps" });
        if (state.regionOpen && state.screen === "condition") trackEvent("recommendation_step_completed", { step: "region", screen: state.screen });
        if (state.pendingHomeDestination) {
          state.screen = state.pendingHomeDestination;
          state.pendingHomeDestination = "";
        }
        state.discoveryLocationError = "";
        render();
        refreshWeather();
      } catch {
        if (requestId !== locationRequestId || state.location.source !== "loading") return;
        trackEvent("location_failed", { failure_reason: "region_lookup_failed" });
        state.pendingHomeDestination = "";
        state.location = previousLocation.source === "gps" ? { ...previousLocation, source: "gps-stale" } : previousLocation;
        state.discoveryLocationError = "현재 지역을 확인하지 못했어요. 다시 시도하거나 직접 선택해 주세요.";
        render();
      }
    })
    .catch((error) => {
      if (requestId !== locationRequestId || state.location.source !== "loading") return;
      trackEvent("location_failed", { failure_reason: error?.code === "os-permission-denied" ? "permission_denied" : "location_unavailable_or_timeout" });
      state.pendingHomeDestination = "";
      state.location = previousLocation.source === "gps" ? { ...previousLocation, source: "gps-stale" } : previousLocation;
      state.discoveryLocationError = error?.code === "os-permission-denied"
        ? "기기 설정에서 위치 사용이 꺼져 있어요. 위치를 켜거나 지역을 직접 선택해 주세요."
        : "위치 사용이 허용되지 않았거나 시간이 초과됐어요. 지역을 직접 선택할 수 있어요.";
      render();
    });
}

trackEvent("app_opened", { screen: state.screen });
render();
refreshWeather();
void refreshCloudData();
})();
