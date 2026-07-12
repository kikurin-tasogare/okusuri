import { getAppEnv } from "../../lib/env.js";
import { pushReminder } from "../../lib/line.js";
import {
  claimReminderSnooze,
  findDueReminders,
  findDueReminderSnoozes,
  findReminderForLineUser,
  hasReminderSendLog,
  recordReminderSendLog
} from "../../lib/reminders.js";
import { requireAdminAuth } from "../../lib/auth.js";
import { ensureResponseHelpers, type VercelRequest, type VercelResponse } from "../../lib/vercel.js";

function tokyoScheduledKey(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}+09:00`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const response = ensureResponseHelpers(res);
  const origin = req.headers.host ? `http://${req.headers.host}` : "http://localhost";
  const appEnv = getAppEnv();
  const auth = req.headers.authorization;
  const request = new Request(`${origin}${req.url ?? "/"}`, {
    method: req.method,
    headers: req.headers as HeadersInit
  });
  const adminAuthError = requireAdminAuth(request);

  if (appEnv.cronSecret && auth !== `Bearer ${appEnv.cronSecret}` && adminAuthError) {
    response.status(401).json({ error: "Unauthorized" });
    return;
  }

  const now = new Date();
  const dueReminders = await findDueReminders(now);
  const scheduledKey = tokyoScheduledKey(now);
  let sent = 0;
  let skipped = 0;

  for (const reminder of dueReminders) {
    if (!reminder.line_user_id) {
      skipped += 1;
      continue;
    }

    if (await hasReminderSendLog(reminder.id, scheduledKey)) {
      skipped += 1;
      continue;
    }

    // Claim the reminder/minute slot before pushing so that overlapping cron
    // invocations cannot both send (the unique constraint arbitrates).
    const claimed = await recordReminderSendLog(reminder.id, scheduledKey);
    if (!claimed) {
      skipped += 1;
      continue;
    }

    await pushReminder(reminder.line_user_id, reminder.id, reminder.title, reminder.action_label);
    sent += 1;
  }

  const dueSnoozes = await findDueReminderSnoozes(now);

  for (const snooze of dueSnoozes) {
    // Snoozes use delete-after-claim instead of reminder_send_logs, so a snoozed
    // re-push is never blocked by the original send's dedupe entry.
    const claimed = await claimReminderSnooze(snooze.id);
    if (!claimed) {
      skipped += 1;
      continue;
    }

    const reminder = await findReminderForLineUser(snooze.reminder_id, snooze.line_user_id);
    if (!reminder || !reminder.enabled || !reminder.line_user_id) {
      skipped += 1;
      continue;
    }

    await pushReminder(reminder.line_user_id, reminder.id, reminder.title, reminder.action_label);
    sent += 1;
  }

  response.status(200).json({ sent, skipped, scheduledKey });
}
