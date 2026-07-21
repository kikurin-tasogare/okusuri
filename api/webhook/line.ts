import {
  replyAskDays,
  replyAskSnoozeDelay,
  replyAskTime,
  replyDaysUpdated,
  replyDoseLogHistory,
  replyEditCancelled,
  replyEditDaysPrompt,
  replyEditDraftMenu,
  replyEditTimePrompt,
  replyFeatureNotReady,
  replyLinked,
  replyRecorded,
  replyRegistrationConfirm,
  replyRegistrationDone,
  replyReminderDeleted,
  replyReminderList,
  replyReminderNotFound,
  replyRestartRegistration,
  replySnoozed,
  replySnoozedAtTime,
  replySnoozeSkipped,
  replyTimeUpdated,
  replyUsage,
  verifyLineSignature,
  type ReminderDraft
} from "../../lib/line.js";
import { ensureResponseHelpers, readRawBody, type VercelRequest, type VercelResponse } from "../../lib/vercel.js";
import type { PendingEditRow, PendingRegistrationRow, ReminderCategory } from "../../lib/types.js";

const pendingEditTtlMs = 10 * 60 * 1000;
const allowedSnoozeMinutes = [15, 30, 60];

type LineEvent = {
  type: string;
  replyToken: string;
  source?: { userId?: string };
  message?: { type?: string; text?: string };
  postback?: { data?: string; params?: { date?: string; time?: string; datetime?: string } };
};

async function saveLineUser(lineUserId: string) {
  try {
    const { upsertLineUser } = await import("../../lib/reminders.js");
    await upsertLineUser(lineUserId);
  } catch (_error) {
    // The userId is still useful for a manual LINE test before Supabase is connected.
  }
}

async function takePendingEditSafely(lineUserId: string): Promise<PendingEditRow | null> {
  try {
    const { takePendingEdit } = await import("../../lib/reminders.js");
    return await takePendingEdit(lineUserId);
  } catch (_error) {
    // Supabase may not be configured yet: treat it as "no pending edit".
    return null;
  }
}

async function getPendingRegistrationSafely(lineUserId: string): Promise<PendingRegistrationRow | null> {
  try {
    const { getPendingRegistration } = await import("../../lib/reminders.js");
    return await getPendingRegistration(lineUserId);
  } catch (_error) {
    return null;
  }
}

async function setPendingRegistrationSafely(lineUserId: string, title: string, daysOfWeek: number[] | null) {
  try {
    const { setPendingRegistration } = await import("../../lib/reminders.js");
    return await setPendingRegistration(lineUserId, title, daysOfWeek);
  } catch (_error) {
    return false;
  }
}

async function setPendingRegistrationTimeSafely(
  lineUserId: string,
  time: string
): Promise<PendingRegistrationRow | null> {
  try {
    const { setPendingRegistrationTime } = await import("../../lib/reminders.js");
    return await setPendingRegistrationTime(lineUserId, time);
  } catch (_error) {
    return null;
  }
}

async function takePendingRegistrationSafely(lineUserId: string): Promise<PendingRegistrationRow | null> {
  try {
    const { takePendingRegistration } = await import("../../lib/reminders.js");
    return await takePendingRegistration(lineUserId);
  } catch (_error) {
    return null;
  }
}

function isPendingFresh(createdAt: string) {
  return Date.now() - new Date(createdAt).getTime() <= pendingEditTtlMs;
}

function inferCategory(title: string): ReminderCategory {
  if (/薬|くすり|おくすり|錠|カプセル|漢方/.test(title)) return "medicine";
  if (/サプリ|ビタミン|ミネラル/.test(title)) return "supplement";
  if (/水|飲|茶|白湯|コーヒー|プロテイン|クエン酸|重曹/.test(title)) return "drink";
  return "other";
}

function toHalfWidthDigits(text: string) {
  return text.replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0));
}

// Turns a picked "HH:mm" into the next Asia/Tokyo occurrence of that clock time —
// today if it's still ahead, tomorrow if that time has already passed today.
function nextTokyoOccurrence(time: string, now: Date): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  const todayAt = new Date(`${part("year")}-${part("month")}-${part("day")}T${time}:00+09:00`);
  return todayAt.getTime() > now.getTime() ? todayAt : new Date(todayAt.getTime() + 24 * 60 * 60 * 1000);
}

function parseTimeOnly(text: string): string | null {
  const trimmed = toHalfWidthDigits(text.trim());
  const timeMatch = trimmed.match(/^([01]?\d|2[0-3])\s*(?::|：|時)\s*(?:([0-5]?\d)\s*分?)?$/);
  if (!timeMatch) {
    return null;
  }

  const hour = Number(timeMatch[1]);
  const minute = timeMatch[2] ? Number(timeMatch[2]) : 0;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

// Matches a time expression anywhere in a message. Lookarounds keep the
// hour/minute alternations from matching a substring of a longer digit run
// (e.g. the "4" in "24:00"), which would produce a bogus time.
const timeExpressionPattern = /(?<!\d)([01]?\d|2[0-3])\s*(?::|：|時)\s*(?:([0-5]?\d)\s*分?)?(?!\d)/;

const dayOfWeekKanji = "日月火水木金土";

// Day-of-week tokens are matched only as whole whitespace-delimited tokens, so a
// day kanji inside a longer word (日記, 毎日, 水…) never turns into a schedule.
// Returns the days the token names, or null when the token is not a day token.
function parseDayOfWeekToken(token: string): number[] | null {
  const bare = token.startsWith("毎週") ? token.slice("毎週".length) : token;
  if (!bare) {
    // A standalone 毎週 just marks the schedule; it adds no days on its own.
    return [];
  }
  if (bare === "平日") {
    return [1, 2, 3, 4, 5];
  }
  if (bare === "週末") {
    return [0, 6];
  }
  const single = bare.match(/^([日月火水木金土])曜日?$/);
  if (single) {
    return [dayOfWeekKanji.indexOf(single[1])];
  }
  const listParts = bare.split(/[・、,]/);
  if (listParts.length >= 2 && listParts.every((part) => /^[日月火水木金土](?:曜日?)?$/.test(part))) {
    return listParts.map((part) => dayOfWeekKanji.indexOf(part[0]));
  }
  // A compact run of bare day kanji (月水金, 土日, …). A single bare kanji is too
  // ambiguous (水 is a drink, 月 is the moon) and needs 曜/曜日 to count as a day.
  if (bare.length >= 2 && [...bare].every((kanji) => dayOfWeekKanji.includes(kanji))) {
    return [...bare].map((kanji) => dayOfWeekKanji.indexOf(kanji));
  }
  return null;
}

function parseReminderDraft(text: string): ReminderDraft | null {
  const trimmed = toHalfWidthDigits(text.trim());
  const timeMatch = trimmed.match(timeExpressionPattern);
  if (!timeMatch) {
    return null;
  }

  const hour = Number(timeMatch[1]);
  const minute = timeMatch[2] ? Number(timeMatch[2]) : 0;
  const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  const days: number[] = [];
  const titleParts: string[] = [];
  for (const token of trimmed.replace(timeMatch[0], "").split(/\s+/)) {
    if (!token) {
      continue;
    }
    const tokenDays = parseDayOfWeekToken(token);
    if (tokenDays) {
      days.push(...tokenDays);
    } else {
      titleParts.push(token);
    }
  }
  const uniqueDays = [...new Set(days)].sort((a, b) => a - b);
  // All seven days spelled out is the same as the everyday default (null).
  const daysOfWeek = uniqueDays.length === 0 || uniqueDays.length === 7 ? null : uniqueDays;

  const title = titleParts
    .join(" ")
    .replace(/登録|リマインダー|通知|して|ください|お願い|毎日/g, "")
    .replace(/^[\s、。・:：-]+|[\s、。・:：-]+$/g, "")
    .slice(0, 40);

  if (!title) {
    return null;
  }

  const category = inferCategory(title);

  return {
    title,
    time,
    daysOfWeek,
    category,
    actionLabel: category === "other" ? "やったよ" : "飲んだよ"
  };
}

function parseValidDays(value: unknown): number[] | null {
  return Array.isArray(value) &&
    value.length > 0 &&
    value.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    ? (value as number[])
    : null;
}

function reminderDraftFromParts(title: string, time: string, daysOfWeek: number[] | null): ReminderDraft {
  const category = inferCategory(title);
  return {
    title,
    time,
    daysOfWeek,
    category,
    actionLabel: category === "other" ? "やったよ" : "飲んだよ"
  };
}

function normalizeDays(days: number[]) {
  const uniqueDays = [...new Set(days)].sort((a, b) => a - b);
  return uniqueDays.length === 0 || uniqueDays.length === 7 ? null : uniqueDays;
}

// A message with no time in it can still start a guided registration: the title
// (and optionally day tokens) are kept, and the bot asks for the rest step by step.
function parseTitleOnly(text: string): { title: string; daysOfWeek: number[] | null } | null {
  const trimmed = toHalfWidthDigits(text.trim());
  if (!trimmed) {
    return null;
  }

  // A message that contains a time expression is never a title. parseReminderDraft
  // already had its chance to build a full draft from it; if that failed (no title
  // next to the time), turning "10:00" itself into a title would start a garbage
  // registration.
  if (timeExpressionPattern.test(trimmed)) {
    return null;
  }

  const days: number[] = [];
  const titleParts: string[] = [];
  for (const token of trimmed.split(/\s+/)) {
    if (!token) {
      continue;
    }
    const tokenDays = parseDayOfWeekToken(token);
    if (tokenDays) {
      days.push(...tokenDays);
    } else {
      titleParts.push(token);
    }
  }

  const title = titleParts
    .join(" ")
    .replace(/登録|リマインダー|通知|して|ください|お願い|毎日/g, "")
    .replace(/^[\s、。・:：-]+|[\s、。・:：-]+$/g, "")
    .slice(0, 40);

  if (!title) {
    return null;
  }

  return { title, daysOfWeek: normalizeDays(days) };
}

// Returns undefined when the text is not a days-only message; null means every day.
function parseDaysOnly(text: string): number[] | null | undefined {
  const trimmed = toHalfWidthDigits(text.trim());
  if (!trimmed) {
    return undefined;
  }

  const days: number[] = [];
  for (const token of trimmed.split(/\s+/)) {
    if (!token) {
      continue;
    }
    if (token === "毎日") {
      continue;
    }
    const tokenDays = parseDayOfWeekToken(token);
    if (!tokenDays) {
      return undefined;
    }
    days.push(...tokenDays);
  }

  return normalizeDays(days);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const response = ensureResponseHelpers(res);

  if (req.method !== "POST") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const rawBody = await readRawBody(req);
  const signature = req.headers["x-line-signature"];
  const normalizedSignature = Array.isArray(signature) ? signature[0] : signature;

  if (!verifyLineSignature(rawBody, normalizedSignature)) {
    response.status(401).json({ error: "Invalid signature" });
    return;
  }

  const payload = JSON.parse(rawBody) as { events?: LineEvent[] };

  for (const event of payload.events ?? []) {
    const lineUserId = event.source?.userId;
    if (!lineUserId) {
      continue;
    }

    try {
      if (event.type === "follow") {
        await saveLineUser(lineUserId);
        await replyLinked(event.replyToken, lineUserId);
        continue;
      }

      if (event.type === "message" && event.message?.type === "text") {
        await saveLineUser(lineUserId);
        const text = event.message.text?.trim() ?? "";

        const pendingEdit = await takePendingEditSafely(lineUserId);
        if (pendingEdit && isPendingFresh(pendingEdit.created_at)) {
          // A time-edit only reacts to a time message and a days-edit only reacts to
          // a days message; anything else falls through to normal handling (the edit
          // is already cleared, matching the original 時間を変える design).
          if ((pendingEdit.kind ?? "time") === "days") {
            const newDays = parseDaysOnly(text);
            if (newDays !== undefined) {
              const { updateReminderDaysForLineUser } = await import("../../lib/reminders.js");
              if (await updateReminderDaysForLineUser(pendingEdit.reminder_id, lineUserId, newDays)) {
                await replyDaysUpdated(event.replyToken, newDays);
              } else {
                await replyReminderNotFound(event.replyToken);
              }
              continue;
            }
          } else {
            const newTime = parseTimeOnly(text);
            if (newTime) {
              const { updateReminderTimeForLineUser } = await import("../../lib/reminders.js");
              if (await updateReminderTimeForLineUser(pendingEdit.reminder_id, lineUserId, newTime)) {
                await replyTimeUpdated(event.replyToken, newTime);
              } else {
                await replyReminderNotFound(event.replyToken);
              }
              continue;
            }
          }
        }

        // Commands always win over a half-finished guided registration.
        if (/^(一覧|リスト|確認|きろく|記録|ログ|使い方|ヘルプ|help|登録)$/.test(text)) {
          await takePendingRegistrationSafely(lineUserId);
        }

        if (/^(一覧|リスト|確認)$/.test(text)) {
          const { listRemindersForLineUser } = await import("../../lib/reminders.js");
          await replyReminderList(event.replyToken, await listRemindersForLineUser(lineUserId));
          continue;
        }

        if (/^(きろく|記録|ログ)$/.test(text)) {
          const { listDoseLogHistoryForLineUser } = await import("../../lib/reminders.js");
          await replyDoseLogHistory(event.replyToken, await listDoseLogHistoryForLineUser(lineUserId));
          continue;
        }

        if (/^(使い方|ヘルプ|help|登録)$/.test(text)) {
          await replyUsage(event.replyToken);
          continue;
        }

        const draft = parseReminderDraft(text);
        if (draft) {
          // A complete one-shot registration replaces any half-finished guided one.
          await takePendingRegistrationSafely(lineUserId);
          await replyRegistrationConfirm(event.replyToken, draft);
          continue;
        }

        const pendingRegistration = await getPendingRegistrationSafely(lineUserId);
        if (pendingRegistration && isPendingFresh(pendingRegistration.created_at)) {
          if (!pendingRegistration.time) {
            const time = parseTimeOnly(text);
            if (time) {
              const updated = await setPendingRegistrationTimeSafely(lineUserId, time);
              if (!updated) {
                await replyRestartRegistration(event.replyToken);
              } else if (updated.days_of_week && updated.days_of_week.length > 0) {
                // Days were given up front ("平日 おくすり"): nothing left to ask.
                await takePendingRegistrationSafely(lineUserId);
                await replyRegistrationConfirm(
                  event.replyToken,
                  reminderDraftFromParts(updated.title, time, updated.days_of_week)
                );
              } else {
                await replyAskDays(event.replyToken, time);
              }
              continue;
            }
            // Not a time and no command/one-shot registration matched above: re-ask
            // rather than silently discarding this registration for a new one.
            await replyAskTime(event.replyToken, pendingRegistration.title);
            continue;
          } else {
            const days = parseDaysOnly(text);
            if (days !== undefined) {
              await takePendingRegistrationSafely(lineUserId);
              await replyRegistrationConfirm(
                event.replyToken,
                reminderDraftFromParts(pendingRegistration.title, pendingRegistration.time, days)
              );
              continue;
            }
            // A time while we're asking for days means "actually, change the time":
            // store it and ask for the days again with the new time.
            const newTime = parseTimeOnly(text);
            if (newTime) {
              if (await setPendingRegistrationTimeSafely(lineUserId, newTime)) {
                await replyAskDays(event.replyToken, newTime);
              } else {
                await replyRestartRegistration(event.replyToken);
              }
              continue;
            }
            // Neither a valid day nor a time: re-ask rather than silently discarding
            // this registration for a new one.
            await replyAskDays(event.replyToken, pendingRegistration.time);
            continue;
          }
        } else if (pendingRegistration) {
          // Too old: forget it and treat the message normally.
          await takePendingRegistrationSafely(lineUserId);
        }

        const titleOnly = parseTitleOnly(text);
        if (titleOnly && (await setPendingRegistrationSafely(lineUserId, titleOnly.title, titleOnly.daysOfWeek))) {
          await replyAskTime(event.replyToken, titleOnly.title);
          continue;
        }

        await replyUsage(event.replyToken);
        continue;
      }

      if (event.type === "postback" && event.postback?.data) {
        const data = JSON.parse(event.postback.data) as {
          type?: string;
          reminderId?: string;
          title?: string;
          time?: string;
          days?: unknown;
          daysOfWeek?: unknown;
          category?: ReminderCategory;
          actionLabel?: "飲んだよ" | "やったよ";
          minutes?: unknown;
        };

        if (data.type === "reg-time" && event.postback.params?.time) {
          const time = event.postback.params.time;
          const pending = await getPendingRegistrationSafely(lineUserId);
          if (!pending || !isPendingFresh(pending.created_at)) {
            await takePendingRegistrationSafely(lineUserId);
            await replyRestartRegistration(event.replyToken);
          } else {
            const updated = await setPendingRegistrationTimeSafely(lineUserId, time);
            if (!updated) {
              await replyRestartRegistration(event.replyToken);
            } else if (updated.days_of_week && updated.days_of_week.length > 0) {
              await takePendingRegistrationSafely(lineUserId);
              await replyRegistrationConfirm(
                event.replyToken,
                reminderDraftFromParts(updated.title, time, updated.days_of_week)
              );
            } else {
              await replyAskDays(event.replyToken, time);
            }
          }
        }

        if (data.type === "reg-days") {
          const days =
            Array.isArray(data.days) &&
            data.days.length > 0 &&
            data.days.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)
              ? (data.days as number[])
              : null;
          const pending = await takePendingRegistrationSafely(lineUserId);
          if (pending && pending.time && isPendingFresh(pending.created_at)) {
            await replyRegistrationConfirm(
              event.replyToken,
              reminderDraftFromParts(pending.title, pending.time, days)
            );
          } else {
            await replyRestartRegistration(event.replyToken);
          }
        }

        // A not-yet-saved draft's 編集する button: show the same kind of choices
        // (time / days / cancel) the 一覧 card offers for already-saved reminders.
        if (data.type === "edit-draft" && data.title && data.time && data.category && data.actionLabel) {
          await replyEditDraftMenu(
            event.replyToken,
            reminderDraftFromParts(data.title, data.time, parseValidDays(data.daysOfWeek))
          );
        }

        if (data.type === "edit-draft-time" && data.title) {
          // Time is being replaced; keep whatever days were already chosen.
          if (await setPendingRegistrationSafely(lineUserId, data.title, parseValidDays(data.daysOfWeek))) {
            await replyAskTime(event.replyToken, data.title);
          } else {
            await replyRestartRegistration(event.replyToken);
          }
        }

        if (data.type === "edit-draft-days" && data.title && data.time) {
          // Days are being replaced; reset to "time set, days not yet chosen" so the
          // normal awaiting-days branch (and the day chips) picks this up.
          const started = await setPendingRegistrationSafely(lineUserId, data.title, null);
          const updated = started ? await setPendingRegistrationTimeSafely(lineUserId, data.time) : null;
          if (updated) {
            await replyAskDays(event.replyToken, data.time);
          } else {
            await replyRestartRegistration(event.replyToken);
          }
        }

        if (data.type === "edit-draft-cancel") {
          await replyEditCancelled(event.replyToken);
        }

        if (data.type === "edit-time-pick" && event.postback.params?.time) {
          const time = event.postback.params.time;
          const pendingEdit = await takePendingEditSafely(lineUserId);
          // The kind check keeps an old time-picker chip from retargeting a pending
          // days edit (and vice versa for the edit-days chips below).
          if (pendingEdit && (pendingEdit.kind ?? "time") === "time" && isPendingFresh(pendingEdit.created_at)) {
            const { updateReminderTimeForLineUser } = await import("../../lib/reminders.js");
            if (await updateReminderTimeForLineUser(pendingEdit.reminder_id, lineUserId, time)) {
              await replyTimeUpdated(event.replyToken, time);
            } else {
              await replyReminderNotFound(event.replyToken);
            }
          } else {
            await replyReminderNotFound(event.replyToken);
          }
        }
        if (data.type === "record-reminder" && data.reminderId) {
          // A tap on an old notification whose reminder was deleted must not die
          // silently (recordReminder throws): answer with "not found" instead.
          const { findReminderForLineUser, recordReminder } = await import("../../lib/reminders.js");
          if (await findReminderForLineUser(data.reminderId, lineUserId)) {
            await recordReminder(data.reminderId, lineUserId);
            await replyRecorded(event.replyToken);
          } else {
            await replyReminderNotFound(event.replyToken);
          }
        }

        if (
          data.type === "create-reminder" &&
          data.title &&
          data.time &&
          data.category &&
          data.actionLabel
        ) {
          const { createReminder, listRemindersForLineUser } = await import("../../lib/reminders.js");
          const daysOfWeek = parseValidDays(data.daysOfWeek);
          // The 登録する button stays tappable in the chat history: a double tap (or a
          // re-tap on an old confirm card) must not create a second identical reminder.
          const daysKey = JSON.stringify(daysOfWeek);
          const alreadyExists = (await listRemindersForLineUser(lineUserId)).some(
            (reminder) =>
              reminder.title === data.title &&
              reminder.time === data.time &&
              JSON.stringify(reminder.days_of_week ?? null) === daysKey
          );
          if (!alreadyExists) {
            await createReminder({
              title: data.title,
              time: data.time,
              daysOfWeek,
              enabled: true,
              actionLabel: data.actionLabel,
              kind: data.category === "other" ? "task" : "drink",
              category: data.category,
              lineUserId
            });
          }
          await replyRegistrationDone(event.replyToken, {
            title: data.title,
            time: data.time,
            daysOfWeek,
            category: data.category,
            actionLabel: data.actionLabel
          });
        }

        if (data.type === "delete-reminder" && data.reminderId) {
          const { deleteReminderForLineUser } = await import("../../lib/reminders.js");
          const deleted = await deleteReminderForLineUser(data.reminderId, lineUserId);
          if (deleted) {
            // The undo button carries the deleted content as a create-reminder
            // postback, so tapping it re-registers through the existing path.
            await replyReminderDeleted(event.replyToken, {
              title: deleted.title,
              time: deleted.time,
              daysOfWeek: deleted.days_of_week,
              category: deleted.category,
              actionLabel: deleted.action_label === "やったよ" ? "やったよ" : "飲んだよ"
            });
          } else {
            await replyReminderNotFound(event.replyToken);
          }
        }

        if (data.type === "snooze-ask" && data.reminderId) {
          const { findReminderForLineUser } = await import("../../lib/reminders.js");
          if (await findReminderForLineUser(data.reminderId, lineUserId)) {
            await replyAskSnoozeDelay(event.replyToken, data.reminderId);
          } else {
            await replyReminderNotFound(event.replyToken);
          }
        }

        if (data.type === "snooze-reminder" && data.reminderId) {
          const { createReminderSnooze, findReminderForLineUser } = await import("../../lib/reminders.js");
          const minutes = allowedSnoozeMinutes.includes(data.minutes as number) ? (data.minutes as number) : 15;
          const remindAt = new Date(Date.now() + minutes * 60 * 1000);
          if (!(await findReminderForLineUser(data.reminderId, lineUserId))) {
            await replyReminderNotFound(event.replyToken);
          } else if (await createReminderSnooze(data.reminderId, lineUserId, remindAt)) {
            await replySnoozed(event.replyToken, minutes);
          } else {
            await replyFeatureNotReady(event.replyToken);
          }
        }

        if (data.type === "snooze-pick" && data.reminderId && event.postback.params?.time) {
          const time = event.postback.params.time;
          const { createReminderSnooze, findReminderForLineUser } = await import("../../lib/reminders.js");
          const remindAt = nextTokyoOccurrence(time, new Date());
          if (!(await findReminderForLineUser(data.reminderId, lineUserId))) {
            await replyReminderNotFound(event.replyToken);
          } else if (await createReminderSnooze(data.reminderId, lineUserId, remindAt)) {
            await replySnoozedAtTime(event.replyToken, time);
          } else {
            await replyFeatureNotReady(event.replyToken);
          }
        }

        if (data.type === "snooze-skip" && data.reminderId) {
          const { findReminderForLineUser } = await import("../../lib/reminders.js");
          if (await findReminderForLineUser(data.reminderId, lineUserId)) {
            await replySnoozeSkipped(event.replyToken);
          } else {
            await replyReminderNotFound(event.replyToken);
          }
        }

        if (data.type === "edit-reminder-time" && data.reminderId) {
          const { findReminderForLineUser, setPendingEdit } = await import("../../lib/reminders.js");
          if (!(await findReminderForLineUser(data.reminderId, lineUserId))) {
            await replyReminderNotFound(event.replyToken);
          } else if (await setPendingEdit(data.reminderId, lineUserId, "time")) {
            await replyEditTimePrompt(event.replyToken);
          } else {
            await replyFeatureNotReady(event.replyToken);
          }
        }

        if (data.type === "edit-reminder-days" && data.reminderId) {
          const { findReminderForLineUser, setPendingEdit } = await import("../../lib/reminders.js");
          if (!(await findReminderForLineUser(data.reminderId, lineUserId))) {
            await replyReminderNotFound(event.replyToken);
          } else if (await setPendingEdit(data.reminderId, lineUserId, "days")) {
            await replyEditDaysPrompt(event.replyToken);
          } else {
            // Also reached while the pending_edits.kind column migration is missing.
            await replyFeatureNotReady(event.replyToken);
          }
        }

        if (data.type === "edit-days") {
          const days =
            Array.isArray(data.days) &&
            data.days.length > 0 &&
            data.days.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)
              ? (data.days as number[])
              : null;
          const pendingEdit = await takePendingEditSafely(lineUserId);
          if (pendingEdit && (pendingEdit.kind ?? "time") === "days" && isPendingFresh(pendingEdit.created_at)) {
            const { updateReminderDaysForLineUser } = await import("../../lib/reminders.js");
            if (await updateReminderDaysForLineUser(pendingEdit.reminder_id, lineUserId, days)) {
              await replyDaysUpdated(event.replyToken, days);
            } else {
              await replyReminderNotFound(event.replyToken);
            }
          } else {
            await replyReminderNotFound(event.replyToken);
          }
        }
      }
    } catch (error) {
      console.error("LINE webhook event handling failed", error);
    }
  }

  response.status(200).json({ ok: true });
}
