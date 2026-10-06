import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const markupSource = source.slice(source.indexOf("function browseEditorialCard("), source.indexOf("function shareSheet("));
const stylesheet = readFileSync(new URL("../browse-editorial.css", import.meta.url), "utf8");
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

function screen(spots, origin = false) {
  const sandbox = {
    escapeHtml, state: { interest: "cafe", companion: "any", transport: "transit", browseCount: 6, activityScope: "region", location: { label: "서울" } },
    homeActivities: [{ interest: "cafe" }], interests: { cafe: { label: "카페·디저트" } },
    companionOptions: { any: "상관없어" }, transportData: { transit: { label: "대중교통" } },
    browseCandidates: () => spots, originCoords: () => origin ? { lat: 37, lng: 127 } : null,
    hasCoords: Boolean, selectedRegion: () => "서울",
    activityBrowseSelection: () => ({ mode: "region", unlocatedCount: origin ? 0 : spots.length }),
    header: () => '<header>장소 후보</header>', bottomNav: () => '<nav aria-label="하단 메뉴"></nav>',
    spotReason: () => "서울 지역 · 카페 관련 장소", distanceLabel: (km) => `${km}km`,
    crowdContext: (spot) => `<aside data-crowd-spot="${escapeHtml(spot.id)}" hidden></aside>`,
    routeUrl: (spot) => `https://map.kakao.com/link/search/${encodeURIComponent(spot.title)}`,
  };
  vm.createContext(sandbox);
  vm.runInContext(`${markupSource}\nthis.output = browseScreen();`, sandbox);
  return sandbox.output;
}

const spots = [
  { id: "cafe-a", region: "서울", area: "연남동", title: "블루보틀 연남 카페", desc: "커피 한 잔 하며 쉬기", distanceKm: null },
  { id: "cafe-b", region: "서울", area: "청계광장", title: "긴 장소 이름도 잘리지 않고 여러 줄로 읽을 수 있는 카페", desc: "산책 후 쉬어가기", distanceKm: null },
];

test("editorial list keeps real counts, detail/map events, crowd placeholders and tabs", () => {
  const output = screen(spots);
  assert.match(output, /서울에서 찾은 장소 2곳/);
  assert.match(output, /list-heading.*<span>2곳<\/span>/);
  assert.equal((output.match(/data-browse-spot=/g) || []).length, 2);
  assert.equal((output.match(/data-map-link="recommendation"/g) || []).length, 2);
  assert.equal((output.match(/data-crowd-spot=/g) || []).length, 2);
  assert.match(output, /data-action="open-region"/);
  assert.match(output, /data-action="back-condition"/);
  assert.match(output, /data-action="request-location"/);
  assert.match(output, /aria-label="하단 메뉴"/);
  assert.doesNotMatch(output, /browse-editorial__divider/);
  assert.match(stylesheet, /\.browse-editorial__item \{[^}]*padding:16px; border:1px solid var\(--moa-line\); border-radius:16px/);
  assert.match(stylesheet, /\.browse-editorial__item \+ \.browse-editorial__item \{ margin-top:12px/);
  assert.doesNotMatch(output, /undefined/);
});

test("editorial list preserves origin-dependent routing and does not mutate place data", () => {
  const fixture = spots.map((spot) => ({ ...spot, distanceKm: 1.2 }));
  const before = JSON.stringify(fixture);
  const output = screen(fixture, true);
  assert.match(output, /직선 약 1.2km/);
  assert.match(output, /aria-haspopup="dialog">길찾기/);
  assert.doesNotMatch(output, /대중교통 길찾기|지도 보기/);
  assert.match(output, /data-action="browse-nearby"/);
  assert.equal(JSON.stringify(fixture), before);
});

test("editorial list retains empty-state recovery actions and escapes place text", () => {
  const empty = screen([]);
  assert.match(empty, /data-analytics-empty="recommendation"/);
  assert.match(empty, /data-action="open-search"/);
  const output = screen([{ ...spots[0], title: '<script>alert("x")</script>' }]);
  assert.match(output, /&lt;script&gt;/);
  assert.doesNotMatch(output, /<script>/);
});

test("editorial styles isolate the screen and keep titles wrapping without shadows", () => {
  const selectors = [...stylesheet.matchAll(/([^{}]+)\{/g)].map((match) => match[1].trim()).filter((selector) => !selector.startsWith("@") && !selector.startsWith("/*"));
  assert.ok(selectors.every((selector) => selector.startsWith(".browse-editorial")));
  assert.match(stylesheet, /overflow-wrap: anywhere/);
  assert.doesNotMatch(stylesheet, /!important|box-shadow|linear-gradient|text-overflow:\s*ellipsis/);
});
