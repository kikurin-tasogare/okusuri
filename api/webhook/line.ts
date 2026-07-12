import {
  replyLinked,
  replyRecorded,
  replyRegistrationConfirm,
  replyRegistrationDone,
  replyReminderDeleted,
  replyReminderList,
  replyUsage,
  verifyLineSignature,
  type ReminderDraft
} from "../../lib/line.js";
import { ensureResponseHelpers, readRawBody, type VercelRequest, type VercelResponse } from "../../lib/vercel.js";
import type { ReminderCategory } from "../../lib/types.js";

type LineEvent = {
  type: string;
  replyToken: string;
  source?: { userId?: string };
  message?: { type?: string; text?: string };
  postback?: { data?: string };
};

async function saveLineUser(lineUserId: string) {
  try {
    const { upsertLineUser } = await import("../../lib/reminders.js");
    await upsertLineUser(lineUserId);
  } catch (_error) {
    // The userId is still useful for a manual LINE test before Supabase is connected.
  }
}

function inferCategory(title: string): ReminderCategory {
  if (/薬|くすり|おくすり|錠|カプセル|漢方/.test(title)) return "medicine";
  if (/サプリ|ビタミン|ミネラル/.test(title)) return "supplement";
  if (/水|飲|茶|白湯|コーヒー|プロテイン|クエン酸|重曹/.test(title)) return "drink";
  return "other";
}

function parseReminderDraft(text: string): ReminderDraft | null {
  const trimmed = text.trim();
  const timeMatch = trimmed.match(/([01]?\d|2[0-3])\s*(?::|：|時)\s*([0-5]\d)?/);
  if (!timeMatch) {
    return null;
  }

  const hour = Number(timeMatch[1]);
  const minute = timeMatch[2] ? Number(timeMatch[2]) : 0;
  const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  const title = trimmed
    .replace(timeMatch[0], "")
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
    category,
    actionLabel: category === "other" ? "やったよ" : "飲んだよ"
  };
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

    if (event.type === "follow") {
      await saveLineUser(lineUserId);
      await replyLinked(event.replyToken);
      continue;
    }

    if (event.type === "message" && event.message?.type === "text") {
      await saveLineUser(lineUserId);
      const text = event.message.text?.trim() ?? "";

      if (/^(一覧|リスト|確認)$/.test(text)) {
        const { listRemindersForLineUser } = await import("../../lib/reminders.js");
        await replyReminderList(event.replyToken, await listRemindersForLineUser(lineUserId));
        continue;
      }

      if (/^(使い方|ヘルプ|help|登録)$/.test(text)) {
        await replyUsage(event.replyToken);
        continue;
      }

      const draft = parseReminderDraft(text);
      if (draft) {
        await replyRegistrationConfirm(event.replyToken, draft);
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
        category?: ReminderCategory;
        actionLabel?: "飲んだよ" | "やったよ";
      };
      if (data.type === "record-reminder" && data.reminderId) {
        const { recordReminder } = await import("../../lib/reminders.js");
        await recordReminder(data.reminderId, lineUserId);
        await replyRecorded(event.replyToken);
      }

      if (
        data.type === "create-reminder" &&
        data.title &&
        data.time &&
        data.category &&
        data.actionLabel
      ) {
        const { createReminder } = await import("../../lib/reminders.js");
        await createReminder({
          title: data.title,
          time: data.time,
          daysOfWeek: null,
          enabled: true,
          actionLabel: data.actionLabel,
          kind: data.category === "other" ? "task" : "drink",
          category: data.category,
          lineUserId
        });
        await replyRegistrationDone(event.replyToken, {
          title: data.title,
          time: data.time,
          category: data.category,
          actionLabel: data.actionLabel
        });
      }

      if (data.type === "delete-reminder" && data.reminderId) {
        const { deleteReminderForLineUser } = await import("../../lib/reminders.js");
        await deleteReminderForLineUser(data.reminderId, lineUserId);
        await replyReminderDeleted(event.replyToken);
      }
    }
  }

  response.status(200).json({ ok: true });
}
