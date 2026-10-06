import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("visit journal keeps photo hierarchy and existing record actions", async () => {
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const css = await readFile(new URL("../my-editorial.css", import.meta.url), "utf8");
  const record = app.slice(app.indexOf("function recentExploration("), app.indexOf("function dailyDiscoveryCard()"));
  assert.match(record, /my-visit-card__meta[\s\S]*my-visit-card__photo[\s\S]*my-visit-card__copy/);
  assert.match(record, /data-visit-public/);
  assert.match(record, /data-visit-delete/);
  assert.match(record, /escapeHtml\(item.description\)/);
  assert.match(record, /!item.id.startsWith\("preview-"\)/);
  assert.match(css, /aspect-ratio: 4 \/ 3/);
  assert.match(css, /\.my-visit-card__actions button \{\s*min-height: 44px/);
});

test("many-record flow limits summary and paginates month grid with native back", async () => {
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  assert.match(app, /orderedVisits\(\).slice\(0, 3\)/);
  assert.match(app, /visits.slice\(0, state.visitListLimit\)/);
  assert.match(app, /state.visitListLimit \+= 12/);
  assert.match(app, /"visit-history": "my", "visit-detail": state.visitDetailBack/);
  assert.match(app, /window.__MOA_RELEASE__ \? "" : window.location.search/);
  assert.match(app, /if \(!RECORDED_HOME_PREVIEW\) state.explorations = data.visits/);
});
