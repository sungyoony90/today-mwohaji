import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

test("other activities disclose native expandable content with a stateful chevron", async () => {
  const css = await readFile(new URL("activity-editorial.css", root), "utf8");
  const app = await readFile(new URL("app.js", root), "utf8");
  assert.match(app, /<summary><span>다른 활동 더 보기<\/span><svg class="activity-editorial__more-chevron"/);
  assert.match(css, /\.activity-editorial__more\[open\] \.activity-editorial__more-chevron \{ transform: rotate\(180deg\)/);
  assert.doesNotMatch(css.match(/\.activity-editorial__more summary \{([^}]+)\}/)[1], /border-bottom/);
  assert.match(css, /\.activity-editorial__preferences \{ margin-top: 12px/);
});

test("undecided activity copy is informational while all-activity selection remains available", async () => {
  const app = await readFile(new URL("app.js", root), "utf8");
  assert.match(app, /<p class="activity-editorial__unsure">/);
  assert.doesNotMatch(app, /<button[^>]*activity-editorial__unsure/);
  assert.match(app, /data-interest="all"[^>]*>아직 못 골랐어요<\/button>/);
  assert.match(app, /interestChosen: false/);
  assert.match(app, /key !== "culture" && !mainInterests.has\(key\)/);
});

test("hero keeps weather below title in the left column and reserves right column for sticker", async () => {
  const css = await readFile(new URL("home-editorial.css", root), "utf8");
  const app = await readFile(new URL("app.js", root), "utf8");
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\) 42%/);
  assert.match(css, /\.home-editorial__weather-copy\s*\{\s*margin: 16px 0 0/);
  assert.match(app, /가볼까요\?<\/h1><p class="home-editorial__weather-copy">[\s\S]*?<\/p><\/div><div class="home-editorial__mascot-group">/);
  const mascot = css.match(/\.home-editorial__mascot\s*\{([^}]+)\}/)[1];
  assert.doesNotMatch(mascot, /position: absolute|right:|bottom:/);
  assert.match(app, /<p class="home-editorial__weather-copy">\$\{escapeHtml\(heroWeatherCopy\(\)\)\}/);
});

test("editorial home does not inherit the retired home screen selectors", async () => {
  const [html, app] = await Promise.all([
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("app.js", root), "utf8"),
  ]);
  // The retired file currently also owns shared tabs and mood tokens.
  assert.match(html, /<link[^>]+home-prototype\.css/);
  assert.match(app, /<main class="screen home-editorial-screen">/);
  assert.doesNotMatch(app, /<main class="[^"]*\bhome-screen\b[^"]*\bhome-editorial-screen\b/);
});

test("home mascot annotation uses the mood palette, not a reference image color", async () => {
  const css = await readFile(new URL("home-editorial.css", root), "utf8");
  const note = css.match(/\.home-editorial__mascot-note svg\s*\{([^}]+)\}/)?.[1];
  assert.ok(note, "mascot annotation style is present");
  assert.match(note, /stroke:\s*var\(--home-mint\)/);
  assert.doesNotMatch(note, /#[0-9a-f]{3,8}/i);
});

test("home has one recommendation entry without the duplicate location block", async () => {
  const app = await readFile(new URL("app.js", root), "utf8");
  const home = app.slice(app.indexOf("function homeScreen()"), app.indexOf("const homeActivities ="));
  assert.doesNotMatch(home, /homeLocationGate\(|nearbyPlacesSection\(/);
  assert.match(home, /모아에게 추천받기/);
  assert.match(home, /지역이나 장소 검색/);
  assert.match(home, /homeMomentEntry\(\)/);
  assert.match(home, /discoveryChallengeCard\(\)/);
  const activity = app.slice(app.indexOf("function activityScreen()"), app.indexOf("function momentsScreen()"));
  assert.match(activity, /data-action="open-region"/);
  assert.match(app, /data-action="request-location"/);
});
