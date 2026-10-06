const crowdCache = new Map();
const crowdCacheMs = 60 * 1000;
const crowdMaxAgeMs = 30 * 60 * 1000;
// A delayed observation is not live: retain its timestamp for up to one hour.
const crowdDelayedMaxAgeMs = 60 * 60 * 1000;
const weatherCache = new Map();
const weatherCacheMs = 15 * 60 * 1000;
// 광역 지역의 대표 지점과 기상청 동네예보 격자입니다.
// 개인의 GPS 좌표를 날씨 제공자에게 보내지 않습니다.
const weatherRegionCenters = Object.freeze({
  서울: { lat: 37.5665, lng: 126.978, nx: 60, ny: 127 }, 경기: { lat: 37.2636, lng: 127.0286, nx: 60, ny: 121 }, 인천: { lat: 37.4563, lng: 126.7052, nx: 55, ny: 124 },
  부산: { lat: 35.1796, lng: 129.0756, nx: 98, ny: 76 }, 대구: { lat: 35.8714, lng: 128.6014, nx: 89, ny: 90 }, 대전: { lat: 36.3504, lng: 127.3845, nx: 67, ny: 100 },
  광주: { lat: 35.1595, lng: 126.8526, nx: 58, ny: 74 }, 울산: { lat: 35.5384, lng: 129.3114, nx: 102, ny: 84 }, 세종: { lat: 36.48, lng: 127.289, nx: 66, ny: 103 },
  강원: { lat: 37.8813, lng: 127.7298, nx: 73, ny: 134 }, 충북: { lat: 36.6424, lng: 127.489, nx: 69, ny: 106 }, 충남: { lat: 36.659, lng: 126.6728, nx: 55, ny: 106 },
  전북: { lat: 35.8242, lng: 127.148, nx: 63, ny: 89 }, 전남: { lat: 34.8118, lng: 126.3922, nx: 51, ny: 67 }, 경북: { lat: 36.5684, lng: 128.7294, nx: 91, ny: 106 },
  경남: { lat: 35.227, lng: 128.6811, nx: 89, ny: 76 }, 제주: { lat: 33.4996, lng: 126.5312, nx: 52, ny: 38 },
});

function kmaDateTime(timestamp) {
  const date = new Date(timestamp + 9 * 60 * 60 * 1000);
  return {
    date: `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`,
    time: `${String(date.getUTCHours()).padStart(2, "0")}${String(Math.floor(date.getUTCMinutes() / 30) * 30).padStart(2, "0")}`,
  };
}

function parseKmaTime(date, time) {
  if (!/^\d{8}$/.test(String(date)) || !/^\d{4}$/.test(String(time))) return NaN;
  return Date.parse(`${String(date).slice(0, 4)}-${String(date).slice(4, 6)}-${String(date).slice(6, 8)}T${String(time).slice(0, 2)}:${String(time).slice(2, 4)}:00+09:00`);
}

function classifyKmaWeather(pty, sky) {
  if (["2", "3", "6", "7"].includes(String(pty))) return "snow";
  if (["1", "4", "5"].includes(String(pty))) return "rain";
  if (String(pty) !== "0") return "";
  return String(sky) === "1" ? "clear" : ["3", "4"].includes(String(sky)) ? "cloudy" : "";
}

async function fetchKmaWeather(region, center, key, fetcher, now, signal) {
  const base = kmaDateTime(now - 45 * 60 * 1000);
  const url = new URL("https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtFcst");
  Object.entries({ serviceKey: key, pageNo: "1", numOfRows: "1000", dataType: "JSON", base_date: base.date, base_time: base.time, nx: center.nx, ny: center.ny })
    .forEach(([name, value]) => url.searchParams.set(name, String(value)));
  const reply = await fetcher(url, { signal });
  if (!reply.ok) throw new Error("KMA upstream failed");
  const data = await reply.json();
  if (String(data.response?.header?.resultCode) !== "00") throw new Error("KMA response failed");
  const items = data.response?.body?.items?.item;
  if (!Array.isArray(items)) throw new Error("KMA items missing");
  const buckets = new Map();
  items.forEach((item) => {
    const timestamp = parseKmaTime(item.fcstDate, item.fcstTime);
    if (!Number.isFinite(timestamp)) return;
    const bucket = buckets.get(timestamp) || {};
    bucket[item.category] = item.fcstValue;
    buckets.set(timestamp, bucket);
  });
  const candidates = [...buckets.entries()].filter(([timestamp]) => timestamp >= now - 30 * 60 * 1000).sort((a, b) => a[0] - b[0]);
  const [observedAt, values] = candidates.find(([, value]) => value.PTY !== undefined && value.SKY !== undefined) || [];
  const kind = classifyKmaWeather(values?.PTY, values?.SKY);
  if (!kind || !Number.isFinite(observedAt) || observedAt - now > 2 * 60 * 60 * 1000) throw new Error("KMA forecast unavailable");
  return { region, kind, observedAt: new Date(observedAt).toISOString(), source: "기상청 단기예보 조회서비스", scope: "region-representative" };
}

async function fetchOpenMeteoWeather(region, center, fetcher, now, signal) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(center.lat));
  url.searchParams.set("longitude", String(center.lng));
  url.searchParams.set("current", "weather_code");
  url.searchParams.set("timezone", "Asia/Seoul");
  const reply = await fetcher(url, { signal });
  if (!reply.ok) throw new Error("weather upstream failed");
  const data = await reply.json();
  const code = data.current?.weather_code;
  const observedAt = Date.parse(`${data.current?.time || ""}+09:00`);
  if (!Number.isInteger(code) || !Number.isFinite(observedAt) || Math.abs(now - observedAt) > 2 * 60 * 60 * 1000) throw new Error("stale weather");
  const kind = [0, 1].includes(code) ? "clear" : [2, 3, 45, 48].includes(code) ? "cloudy" : [71, 73, 75, 77, 85, 86].includes(code) ? "snow" : [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 97, 99].includes(code) ? "rain" : "";
  if (!kind) throw new Error("unknown weather code");
  return { region, kind, observedAt: new Date(observedAt).toISOString(), source: "Open-Meteo", scope: "region-representative" };
}

export async function getRegionWeather(region, kmaKey, fetcher = fetch, now = Date.now()) {
  const center = weatherRegionCenters[String(region || "")];
  if (!center) return { status: 400, body: { error: "지원하지 않는 지역이에요." } };
  const cached = weatherCache.get(region);
  if (cached && now - cached.time < weatherCacheMs) return { status: 200, body: cached.body };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    let body;
    if (kmaKey && kmaKey !== "replace_with_your_kma_service_key") {
      try { body = await fetchKmaWeather(region, center, kmaKey, fetcher, now, controller.signal); } catch { /* Open-Meteo fallback */ }
    }
    body ||= await fetchOpenMeteoWeather(region, center, fetcher, now, controller.signal);
    weatherCache.set(region, { time: now, body });
    return { status: 200, body };
  } catch {
    return { status: 502, body: { error: "날씨를 확인할 수 없어요." } };
  } finally {
    clearTimeout(timeout);
  }
}

// Each value is an official Seoul city-data area surrounding the catalog spot,
// not venue-level crowding. Unlisted spots never call the upstream API.
export const seoulCrowdAreaBySpotId = Object.freeze({
  "gyeongbok-night": "경복궁",
  "yeouido-nightmarket": "여의도한강공원",
  "ttukseom-picnic": "뚝섬한강공원",
  "jamwon-sup": "잠원한강공원",
  "seoul-forest": "서울숲공원",
  "forest-greenhouse": "서울숲공원",
  "seongsu-cafe": "성수동 카페거리",
  "namsan-tower": "남산공원",
  "climbing-hongdae": "홍대 관광특구",
  "lotte-aquarium": "잠실 관광특구",
  "itaewon-rooftop": "이태원 관광특구",
  "nodeul-island": "노들섬",
  "bukchon-walk": "북촌한옥마을",
  "board-game-konkuk": "건대입구역",
  "ddp-night": "DDP(동대문디자인플라자)",
  "hangang-pool": "여의도한강공원",
  "gwangjang-market": "광장시장",
  "hangang-cruise": "여의도한강공원",
  "ikseon-dong": "익선동",
  "naksan-park": "낙산공원·이화마을",
  "eungbong-night": "응봉산",
  "cheonggye-walk": "종로·청계 관광특구",
  "seokchon-lake": "잠실 관광특구",
  "sebitseom": "반포한강공원",
  "byeolmadang": "강남 MICE 관광특구",
  "hongdae-busking": "홍대 관광특구",
  "seochon-alley": "서촌",
  "hanul-park": "월드컵공원",
  "children-grand-park": "어린이대공원",
  "jazz-evans": "홍대 관광특구",
  "jazz-allthatjazz": "이태원 관광특구",
  "jeongdong-night": "덕수궁길·정동길",
});

function sendJson(response, status, data) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(data));
}

function broadRegion(address) {
  const first = String(address || "").split(/\s+/)[0];
  if (first === "경기도") return "경기";
  if (first === "강원도" || first === "강원특별자치도") return "강원";
  if (first === "제주특별자치도") return "제주";
  const match = {
    서울특별시: "서울", 부산광역시: "부산", 대구광역시: "대구", 인천광역시: "인천",
    광주광역시: "광주", 대전광역시: "대전", 울산광역시: "울산", 세종특별자치시: "세종",
    충청북도: "충북", 충청남도: "충남", 전라북도: "전북", 전북특별자치도: "전북",
    전라남도: "전남", 경상북도: "경북", 경상남도: "경남",
  };
  return match[first] || first;
}

const supportedRegions = new Set(["서울", "경기", "인천", "부산", "대구", "대전", "광주", "울산", "세종", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"]);

export async function lookupRegionFromCoords(latitude, longitude, key, fetcher = fetch) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 32.5 || lat > 39.5 || lng < 124 || lng > 132) {
    return { status: 400, body: { error: "지원하는 국내 위치를 확인할 수 없어요." } };
  }
  if (!key || key === "replace_with_your_rest_api_key") {
    return { status: 503, body: { error: "위치 확인 기능이 아직 설정되지 않았어요." } };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const url = new URL("https://dapi.kakao.com/v2/local/geo/coord2regioncode.json");
    url.searchParams.set("x", String(lng));
    url.searchParams.set("y", String(lat));
    const reply = await fetcher(url, { headers: { Authorization: `KakaoAK ${key}` }, signal: controller.signal });
    if (!reply.ok) return { status: 502, body: { error: "현재 지역을 확인하지 못했어요." } };
    const data = await reply.json();
    const place = data.documents?.find((item) => item.region_type === "H") || data.documents?.find((item) => item.region_type === "B");
    const region = broadRegion(place?.region_1depth_name || "");
    if (!supportedRegions.has(region)) return { status: 422, body: { error: "이 위치의 지역 카드는 아직 지원하지 않아요." } };
    const district = String(place.region_2depth_name || "").slice(0, 30);
    return { status: 200, body: { region, label: district ? `${region} ${district}` : region } };
  } catch {
    return { status: 502, body: { error: "현재 지역 확인에 연결하지 못했어요." } };
  } finally {
    clearTimeout(timeout);
  }
}

export async function searchOrigins(query, key, fetcher = fetch) {
  const term = String(query || "").trim();
  if (!term || term.length > 80) return { status: 400, body: { error: "출발지를 1~80자로 입력해 주세요." } };
  if (!key || key === "replace_with_your_rest_api_key") return { status: 503, body: { error: "카카오 API 키가 아직 로컬 서버에 설정되지 않았어요." } };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const headers = { Authorization: `KakaoAK ${key}` };
    const addressUrl = new URL("https://dapi.kakao.com/v2/local/search/address.json");
    addressUrl.searchParams.set("query", term);
    let reply = await fetcher(addressUrl, { headers, signal: controller.signal });
    if (!reply.ok) return { status: 502, body: { error: "카카오 주소 검색을 사용할 수 없어요. 키와 사용 설정을 확인해 주세요." } };
    let body = await reply.json();
    let kind = "address";
    if (!body.documents?.length) {
      const keywordUrl = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
      keywordUrl.searchParams.set("query", term);
      keywordUrl.searchParams.set("size", "8");
      reply = await fetcher(keywordUrl, { headers, signal: controller.signal });
      if (!reply.ok) return { status: 502, body: { error: "카카오 장소 검색을 사용할 수 없어요. 키와 사용 설정을 확인해 주세요." } };
      body = await reply.json();
      kind = "place";
    }
    const results = (body.documents || []).slice(0, 8).map((item) => {
      const address = item.road_address_name || item.address_name || item.road_address?.address_name || "";
      return {
        label: kind === "place" ? item.place_name : address,
        address,
        region: broadRegion(item.address_name || item.address?.address_name || address),
        lat: Number(item.y),
        lng: Number(item.x),
      };
    }).filter((item) => item.label && item.region && Number.isFinite(item.lat) && Number.isFinite(item.lng));
    return { status: 200, body: { results } };
  } catch {
    return { status: 502, body: { error: "카카오 검색에 연결하지 못했어요. 잠시 후 다시 시도해 주세요." } };
  } finally {
    clearTimeout(timeout);
  }
}

function parseSeoulTime(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second = "00"] = match;
  const timestamp = Date.parse(`${year}-${month}-${day}T${hour}:${minute}:${second}+09:00`);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export async function getSeoulCrowdForSpot(spotId, key, fetcher = fetch, now = Date.now()) {
  const id = String(spotId || "");
  const area = seoulCrowdAreaBySpotId[id];
  if (!area) return { status: 404, body: { error: "혼잡도를 지원하지 않는 장소예요." } };
  if (!key || key === "replace_with_your_api_key") return { status: 503, body: { error: "서울시 API 키가 아직 설정되지 않았어요." } };
  const cached = crowdCache.get(area);
  if (cached && now - cached.time < crowdCacheMs) return { status: 200, body: cached.body };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const url = new URL(`http://openapi.seoul.go.kr:8088/${encodeURIComponent(key)}/json/citydata_ppltn/1/1/${encodeURIComponent(area)}`);
    const reply = await fetcher(url, { signal: controller.signal });
    if (!reply.ok) return { status: 502, body: { error: "서울시 혼잡도 정보를 불러오지 못했어요." } };
    const data = await reply.json();
    const result = data.RESULT?.RESULT || data.RESULT || data.SeoulRtd?.RESULT;
    const resultCode = result?.CODE || result?.["RESULT.CODE"];
    if (resultCode && resultCode !== "INFO-000") return { status: 502, body: { error: "서울시 혼잡도 응답을 확인할 수 없어요." } };
    const rows = data["SeoulRtd.citydata_ppltn"] || data.SeoulRtd?.citydata_ppltn;
    const row = rows?.[0];
    const observedAtMs = parseSeoulTime(row?.PPLTN_TIME);
    const validLevels = new Set(["여유", "보통", "약간 붐빔", "붐빔"]);
    if (!row || row.AREA_NM !== area || !validLevels.has(row.AREA_CONGEST_LVL) || observedAtMs === null || now - observedAtMs > crowdDelayedMaxAgeMs || observedAtMs - now > 10 * 60 * 1000) {
      return { status: 502, body: { error: "최신 혼잡도 정보를 확인할 수 없어요." } };
    }
    const body = {
      area,
      level: row.AREA_CONGEST_LVL,
      observedAt: new Date(observedAtMs).toISOString(),
      source: "서울특별시 실시간 도시데이터",
      affectsRanking: false,
      ...(now - observedAtMs > crowdMaxAgeMs ? { freshness: "delayed" } : {}),
    };
    crowdCache.set(area, { time: now, body });
    return { status: 200, body };
  } catch {
    return { status: 502, body: { error: "서울시 혼잡도 정보에 연결하지 못했어요." } };
  } finally {
    clearTimeout(timeout);
  }
}


const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'apikey,content-type', 'Access-Control-Allow-Methods': 'GET,OPTIONS', 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const publishable = 'sb_publishable_example_for_course_submission';
Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  // Only public, read-only place/weather data; private photo data never goes through this gateway.
  if (request.headers.get('apikey') !== publishable) return new Response(JSON.stringify({error:'허용되지 않은 요청이에요.'}), {status:403,headers});
  if (request.method !== 'GET') return new Response('{}', {status:405,headers});
  const url = new URL(request.url);
  let result;
  try {
    if (url.pathname.endsWith('/api/weather')) result = await getRegionWeather(url.searchParams.get('region'), Deno.env.get('KMA_SERVICE_KEY'));
    else if (url.pathname.endsWith('/api/origins')) result = await searchOrigins(url.searchParams.get('query'), Deno.env.get('KAKAO_REST_API_KEY'));
    else if (url.pathname.endsWith('/api/location-region')) result = await lookupRegionFromCoords(url.searchParams.get('lat'),url.searchParams.get('lng'),Deno.env.get('KAKAO_REST_API_KEY'));
    else if (url.pathname.endsWith('/api/crowd')) result = await getSeoulCrowdForSpot(url.searchParams.get('spotId'),Deno.env.get('SEOUL_OPEN_DATA_API_KEY'));
    else result = {status:404,body:{error:'찾을 수 없는 기능이에요.'}};
  } catch { result = {status:502,body:{error:'잠시 후 다시 시도해 주세요.'}}; }
  return new Response(JSON.stringify(result.body), {status:result.status,headers});
});
