// SPDX-FileCopyrightText: 2026 Kaede Akino
// SPDX-License-Identifier: AGPL-3.0-or-later
import assert from "node:assert/strict";
import { test } from "node:test";
import { harness, songDetails } from "./harness.ts";

// Starting playback updates cloud history without claiming the whole song was heard.
test("played sends startplay and keeps the local recent list", async () => {
  const h = await harness(
    ({ path, params }) => (path === "/api/v3/song/detail" ? songDetails(params) : {}),
    { signedIn: true },
  );
  await h.plugin.played({ id: "52" });
  const call = h.calls.find((c) => c.path === "/api/feedback/weblog");
  assert.ok(call);
  const [log] = JSON.parse(String(call.params.logs));
  assert.equal(log.action, "startplay");
  assert.equal(log.json.id, "52");
  assert.equal(log.json.time, undefined);
  assert.equal(h.state.get("recent")?.[0].id, "52");
});

// Listening used to stay local instead of reaching NetEase's listening history.
test("scrobble sends actual listened seconds through authenticated EAPI", async () => {
  const h = await harness(() => ({}), { signedIn: true });
  await h.plugin.scrobble({ id: "52", seconds: 75 });
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].path, "/api/feedback/weblog");
  assert.match(h.calls[0].url.pathname, /^\/eapi\//);
  assert.match(h.calls[0].options.headers.Cookie, /os=osx/);
  const [log] = JSON.parse(String(h.calls[0].params.logs));
  assert.equal(log.action, "play");
  assert.equal(log.json.id, "52");
  assert.equal(log.json.time, 75);
  assert.equal(log.json.type, "song");
});

// Signed-out, invalid durations and podcast plays must not become song listens.
test("scrobble skips signed-out playback and rejects invalid durations", async () => {
  const h = await harness(() => ({}));
  await h.plugin.scrobble({ id: "52", seconds: 75 });
  assert.equal(h.calls.length, 0);
  const signed = await harness(() => ({}), { signedIn: true });
  for (const seconds of [0, -1, NaN, Infinity]) {
    await assert.rejects(() => signed.plugin.scrobble({ id: "52", seconds }));
  }
  assert.equal(signed.calls.length, 0);
  await signed.plugin.scrobble({ id: "program:5:52", seconds: 75 });
  assert.equal(signed.calls.length, 0);
});

// A rejected submission must remain visible instead of looking successful.
test("scrobble propagates a service rejection", async () => {
  const h = await harness(() => ({ code: 500 }), { signedIn: true });
  await assert.rejects(() => h.plugin.scrobble({ id: "52", seconds: 75 }));
});
