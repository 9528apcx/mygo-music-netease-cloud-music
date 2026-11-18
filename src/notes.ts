// SPDX-FileCopyrightText: 2026 Kaede Akino
// SPDX-License-Identifier: AGPL-3.0-or-later

import { eapi } from "./api.js";
import { NOTE_PUBLISH_PATH, SITE } from "./constants.js";
import { requireAccount } from "./session.js";
import type { ByID } from "./types.js";
import { fail, id, tr } from "./utils.js";

export async function shareNote({ kind, id: value, text }: ByID & { kind: string; text: string }) {
  const account = requireAccount();
  if (kind !== "song" && kind !== "album") throw fail("unavailable", tr("Unsupported note item"));
  const itemId = id(value);
  const link = `${SITE}/${kind}?id=${itemId}`;
  const result = await eapi<{ id?: string | number }>(NOTE_PUBLISH_PATH, {
    uid: account.id,
    uuid: host.crypto.md5(`${Date.now()}:${Math.random()}`),
    msg: [text.trim(), link].filter(Boolean).join("\n\n"),
    type: kind === "song" ? "song" : "noresource",
    ...(kind === "song" ? { id: itemId } : {}),
    addComment: false,
    privacySetting: "0",
    socialSpaceVisible: 1,
  });
  if (!result.id) throw new Error(tr("NetEase did not return a note ID"));
}
