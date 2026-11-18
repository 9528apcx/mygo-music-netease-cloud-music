// SPDX-FileCopyrightText: 2026 Kaede Akino
// SPDX-License-Identifier: AGPL-3.0-or-later

import { eapi, web } from "./api.js";
import { PAGE } from "./constants.js";
import { toComment, trackIdentity } from "./models.js";
import type { ServiceComment } from "./service-types.js";
import { requireAccount } from "./session.js";
import type { ByID, CommentTarget, PageOptions } from "./types.js";
import { id, offsetOf, tr } from "./utils.js";

export async function comments({ trackId, offset = 0 }: CommentTarget & PageOptions) {
  return threadComments(trackIdentity(trackId).thread, offset);
}

export async function albumComments({ id: albumId, offset = 0 }: ByID & PageOptions) {
  return threadComments(`R_AL_3_${id(albumId)}`, offset);
}

async function threadComments(thread: string, offset: number) {
  const result = await web<{
    comments?: ServiceComment[];
    total?: number;
    more?: boolean;
  }>(`/api/v1/resource/comments/${thread}`, {
    limit: PAGE,
    offset: offsetOf(offset),
  });
  // Only latest comments count toward the host's numeric pagination offset.
  // Hot comments have their own browse page so they cannot skip later comments.
  return {
    comments: (result.comments || []).map(toComment),
    total: result.total || 0,
    more: !!result.more,
  };
}

export async function likeComment({
  trackId,
  commentId,
  on,
}: CommentTarget & { commentId: string; on: boolean }) {
  requireAccount();
  await eapi(`/api/v1/comment/${on ? "like" : "unlike"}`, {
    threadId: trackIdentity(trackId).thread,
    commentId: id(commentId),
  });
}

export async function postComment({ trackId, text }: CommentTarget & { text: string }) {
  return submitComment(trackIdentity(trackId).thread, text);
}

export async function replyComment({
  trackId,
  commentId,
  text,
}: CommentTarget & { commentId: string; text: string }) {
  return submitComment(trackIdentity(trackId).thread, text, id(commentId));
}

export async function postAlbumComment({
  id: albumId,
  text,
  replyTo,
}: ByID & { text: string; replyTo?: string }) {
  return submitComment(`R_AL_3_${id(albumId)}`, text, replyTo);
}

async function submitComment(threadId: string, text: string, replyTo?: string) {
  requireAccount();
  if (!text.trim()) throw new Error(tr("Comment cannot be empty"));
  const result = await eapi<{ comment?: ServiceComment }>(
    replyTo ? "/api/resource/comments/reply" : "/api/resource/comments/add",
    { threadId, content: text.trim(), ...(replyTo ? { commentId: id(replyTo) } : {}) },
  );
  if (!result.comment)
    throw new Error(
      tr("NetEase did not return the posted comment. Refresh to check before posting again."),
    );
  return toComment(result.comment);
}
