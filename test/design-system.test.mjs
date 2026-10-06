import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

test("both stylesheets use only the approved corner radius scale", async () => {
  const tokens = await readFile(new URL("design-system.css", root), "utf8");
  const legacy = await readFile(new URL("styles.css", root), "utf8");
  for (const [name, value] of Object.entries({ xs: 4, sm: 8, md: 12, lg: 16, xl: 20 })) {
    assert.match(tokens, new RegExp(`--ds-radius-${name}: ${value}px;`));
  }
  for (const [name, css] of [["design-system.css", tokens], ["styles.css", legacy]]) {
    for (const [, value] of css.matchAll(/border-radius:\s*([^;}]+)/g)) {
      const withoutTokens = value.replace(/var\(--ds-radius-(?:xs|sm|md|lg|xl|pill)\)/g, "");
      assert.doesNotMatch(withoutTokens, /\d+px/, `${name}: unexpected radius ${value}`);
    }
  }
});
