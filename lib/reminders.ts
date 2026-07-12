import { supabase } from "./supabase.js";
import { decryptPrivateText, encryptPrivateText } from "./privacy.js";
import type {
  DoseLogHistoryEntry,
  LineUserRow,
  PendingEditKind,
  PendingEditRow,
  PendingRegistrationRow,
  ReminderAdminSummaryRow,
  ReminderCategory,
  ReminderKind,
  ReminderRow,
  ReminderSnoozeRow
} from "./types.js";

// A missing table surfaces as PGRST205 ("could not find the table in the schema
// cache") through Supabase's REST layer, not as Postgres's raw 42P01.
function isMissingTableError(error: { code?: string }) {
  return error.code === "42P01" || error.code === "PGRST205";
}

// A column that exists in the code but not yet in the database surfaces as
// PGRST204 ("could not find the column in the schema cache") through Supabase's
// REST layer, or as Postgres's raw 42703.
function isMissingColumnError(error: { code?: string }) {
  return error.code === "42703" || error.code === "PGRST204";
}

export async function upsertLineUser(lineUserId: string) {
  const { error } = await supabase.from("line_users").upsert(
    {
      line_user_id: lineUserId,
      linked_at: new Date().toISOString()
    },
    {
      onConflict: "line_user_id"
    }
  );

  if (error) {
    throw error;
  }
}

export async function createReminder(input: {
  title: string;
  time: string;
  daysOfWeek: number[] | null;
  enabled: boolean;
  actionLabel: string;
  kind: ReminderKind;
  category: ReminderCategory;
  lineUserId: string;
}) {
  const { error } = await supabase.from("reminders").insert({
    title: encryptPrivateText(input.title),
    time: input.time,
    days_of_week: input.daysOfWeek,
    enabled: input.enabled,
    action_label: input.actionLabel,
    kind: input.kind,
    category: input.category,
    line_user_id: input.lineUserId
  });

  if (error) {
    throw error;
  }
}

export async function listLineUsers() {
  const { data, error } = await supabase
    .from("line_users")
    .select("line_user_id, linked_at")
    .order("linked_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as LineUserRow[];
}

export async function listReminders() {
  const { data, error } = await supabase
    .from("reminders")
    .select("id, title, time, days_of_week, enabled, action_label, kind, category, line_user_id")
    .order("time", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as ReminderRow[];
}

export async function listReminderAdminSummaries() {
  const { data, error } = await supabase
    .from("reminders")
    .select("id, enabled, category, line_user_id, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as ReminderAdminSummaryRow[];
}

export async function listRemindersForLineUser(lineUserId: string) {
  const { data, error } = await supabase
    .from("reminders")
    .select("id, title, time, days_of_week, enabled, action_label, kind, category, line_user_id")
    .eq("line_user_id", lineUserId)
    .order("time", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as ReminderRow[]).map((reminder) => ({
    ...reminder,
    title: decryptPrivateText(reminder.title)
  }));
}

export async function deleteReminder(reminderId: string) {
  const { error } = await supabase.from("reminders").delete().eq("id", reminderId);

  if (error) {
    throw error;
  }
}

export async function deleteReminderForLineUser(reminderId: string, lineUserId: string) {
  const { error } = await supabase
    .from("reminders")
    .delete()
    .eq("id", reminderId)
    .eq("line_user_id", lineUserId);

  if (error) {
    throw error;
  }
}

async function assertReminderOwnedByLineUser(reminderId: string, lineUserId: string) {
  const { data: reminder, error } = await supabase
    .from("reminders")
    .select("id, line_user_id")
    .eq("id", reminderId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!reminder || reminder.line_user_id !== lineUserId) {
    throw new Error("Reminder not found");
  }
}

export async function updateReminderDaysForLineUser(
  reminderId: string,
  lineUserId: string,
  daysOfWeek: number[] | null
) {
  const { data, error } = await supabase
    .from("reminders")
    .update({ days_of_week: daysOfWeek })
    .eq("id", reminderId)
    .eq("line_user_id", lineUserId)
    .select("id");

  if (error) {
    throw error;
  }

  return (data ?? []).length > 0;
}

export async function updateReminderTimeForLineUser(reminderId: string, lineUserId: string, time: string) {
  const { data, error } = await supabase
    .from("reminders")
    .update({ time })
    .eq("id", reminderId)
    .eq("line_user_id", lineUserId)
    .select("id");

  if (error) {
    throw error;
  }

  return (data ?? []).length > 0;
}

export async function recordReminder(reminderId: string, lineUserId: string) {
  await assertReminderOwnedByLineUser(reminderId, lineUserId);

  const { error } = await supabase.from("dose_logs").insert({
    reminder_id: reminderId,
    taken_at: new Date().toISOString(),
    status: "taken"
  });

  if (error) {
    throw error;
  }
}

export async function hasReminderSendLog(reminderId: string, scheduledKey: string) {
  const { data, error } = await supabase
    .from("reminder_send_logs")
    .select("id")
    .eq("reminder_id", reminderId)
    .eq("scheduled_key", scheduledKey)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) {
      return false;
    }
    throw error;
  }

  return Boolean(data);
}

export async function recordReminderSendLog(reminderId: string, scheduledKey: string) {
  const { error } = await supabase.from("reminder_send_logs").insert({
    reminder_id: reminderId,
    scheduled_key: scheduledKey
  });

  if (error) {
    if (isMissingTableError(error)) {
      // The send-log table has not been created yet: dedupe is unavailable,
      // so let the caller proceed with sending (same behavior as before the table existed).
      return true;
    }
    if (error.code === "23505") {
      // Another invocation already claimed this reminder/minute slot.
      return false;
    }
    throw error;
  }

  return true;
}

export async function findDueReminders(now: Date) {
  const tokyoParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23"
  }).formatToParts(now);
  const part = (type: string) => tokyoParts.find((item) => item.type === type)?.value ?? "";
  const hh = part("hour");
  const mm = part("minute");
  const currentTime = `${hh}:${mm}`;
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
  };
  const day = dayMap[part("weekday")] ?? now.getDay();

  const { data, error } = await supabase
    .from("reminders")
    .select("id, title, time, days_of_week, enabled, action_label, kind, category, line_user_id")
    .eq("enabled", true)
    .eq("time", currentTime)
    .not("line_user_id", "is", null);

  if (error) {
    throw error;
  }

  return ((data ?? []) as ReminderRow[]).filter((reminder) => {
    if (!reminder.days_of_week || reminder.days_of_week.length === 0) {
      return true;
    }
    return reminder.days_of_week.includes(day);
  });
}

export async function createReminderSnooze(reminderId: string, lineUserId: string, remindAt: Date) {
  await assertReminderOwnedByLineUser(reminderId, lineUserId);

  // Replace any snooze already queued for this reminder: a double tap on あとで
  // (or a tap on an older notification) must not stack up extra re-pushes.
  const { error: clearError } = await supabase
    .from("reminder_snoozes")
    .delete()
    .eq("reminder_id", reminderId)
    .eq("line_user_id", lineUserId);

  if (clearError && !isMissingTableError(clearError)) {
    throw clearError;
  }

  const { error } = await supabase.from("reminder_snoozes").insert({
    reminder_id: reminderId,
    line_user_id: lineUserId,
    remind_at: remindAt.toISOString()
  });

  if (error) {
    if (isMissingTableError(error)) {
      // The snooze table has not been created yet.
      return false;
    }
    throw error;
  }

  return true;
}

export async function findDueReminderSnoozes(now: Date) {
  const { data, error } = await supabase
    .from("reminder_snoozes")
    .select("id, reminder_id, line_user_id, remind_at")
    .lte("remind_at", now.toISOString());

  if (error) {
    if (isMissingTableError(error)) {
      return [] as ReminderSnoozeRow[];
    }
    throw error;
  }

  return (data ?? []) as ReminderSnoozeRow[];
}

export async function claimReminderSnooze(snoozeId: string) {
  const { data, error } = await supabase
    .from("reminder_snoozes")
    .delete()
    .eq("id", snoozeId)
    .select("id");

  if (error) {
    if (isMissingTableError(error)) {
      return false;
    }
    throw error;
  }

  // Delete-after-claim: only the invocation that actually deleted the row may push,
  // so a snooze fires exactly once even with overlapping cron runs.
  return (data ?? []).length > 0;
}

export async function findReminderForLineUser(reminderId: string, lineUserId: string) {
  const { data, error } = await supabase
    .from("reminders")
    .select("id, title, time, days_of_week, enabled, action_label, kind, category, line_user_id")
    .eq("id", reminderId)
    .eq("line_user_id", lineUserId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as ReminderRow | null) ?? null;
}

export async function setPendingEdit(reminderId: string, lineUserId: string, kind: PendingEditKind = "time") {
  await assertReminderOwnedByLineUser(reminderId, lineUserId);

  const basePayload = {
    line_user_id: lineUserId,
    reminder_id: reminderId,
    created_at: new Date().toISOString()
  };

  // kind is always written explicitly: the upsert must overwrite the kind left
  // behind by a previous edit of the other flavor.
  let { error } = await supabase
    .from("pending_edits")
    .upsert({ ...basePayload, kind }, { onConflict: "line_user_id" });

  if (error && isMissingColumnError(error)) {
    if (kind !== "time") {
      // A days edit needs the kind column: without the migration it stays unavailable.
      return false;
    }
    // Pre-migration table without the kind column: a time edit still works as before.
    ({ error } = await supabase.from("pending_edits").upsert(basePayload, { onConflict: "line_user_id" }));
  }

  if (error) {
    if (isMissingTableError(error)) {
      // The pending-edit table has not been created yet.
      return false;
    }
    throw error;
  }

  return true;
}

export async function takePendingEdit(lineUserId: string) {
  // select("*") keeps this working whether or not the kind column exists yet.
  const { data, error } = await supabase
    .from("pending_edits")
    .delete()
    .eq("line_user_id", lineUserId)
    .select("*")
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) {
      return null;
    }
    throw error;
  }

  return (data as PendingEditRow | null) ?? null;
}

const pendingRegistrationColumns = "line_user_id, title, time, days_of_week, created_at";

function decryptPendingRegistration(data: unknown) {
  const row = data as PendingRegistrationRow | null;
  return row ? { ...row, title: decryptPrivateText(row.title) } : null;
}

export async function setPendingRegistration(lineUserId: string, title: string, daysOfWeek: number[] | null) {
  const { error } = await supabase.from("pending_registrations").upsert(
    {
      line_user_id: lineUserId,
      title: encryptPrivateText(title),
      time: null,
      days_of_week: daysOfWeek,
      created_at: new Date().toISOString()
    },
    {
      onConflict: "line_user_id"
    }
  );

  if (error) {
    if (isMissingTableError(error)) {
      // The pending-registration table has not been created yet.
      return false;
    }
    throw error;
  }

  return true;
}

export async function getPendingRegistration(lineUserId: string) {
  const { data, error } = await supabase
    .from("pending_registrations")
    .select(pendingRegistrationColumns)
    .eq("line_user_id", lineUserId)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) {
      return null;
    }
    throw error;
  }

  return decryptPendingRegistration(data);
}

export async function setPendingRegistrationTime(lineUserId: string, time: string) {
  const { data, error } = await supabase
    .from("pending_registrations")
    .update({ time })
    .eq("line_user_id", lineUserId)
    .select(pendingRegistrationColumns)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) {
      return null;
    }
    throw error;
  }

  return decryptPendingRegistration(data);
}

export async function takePendingRegistration(lineUserId: string) {
  const { data, error } = await supabase
    .from("pending_registrations")
    .delete()
    .eq("line_user_id", lineUserId)
    .select(pendingRegistrationColumns)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) {
      return null;
    }
    throw error;
  }

  return decryptPendingRegistration(data);
}

export async function listDoseLogHistoryForLineUser(lineUserId: string) {
  const { data: reminders, error: remindersError } = await supabase
    .from("reminders")
    .select("id, title")
    .eq("line_user_id", lineUserId);

  if (remindersError) {
    throw remindersError;
  }

  const reminderRows = (reminders ?? []) as Array<{ id: string; title: string }>;
  if (reminderRows.length === 0) {
    return [] as DoseLogHistoryEntry[];
  }

  const titleByReminderId = new Map(
    reminderRows.map((reminder) => [reminder.id, decryptPrivateText(reminder.title)])
  );

  const { data: logs, error: logsError } = await supabase
    .from("dose_logs")
    .select("id, reminder_id, taken_at")
    .in(
      "reminder_id",
      reminderRows.map((reminder) => reminder.id)
    )
    .order("taken_at", { ascending: false })
    .limit(10);

  if (logsError) {
    throw logsError;
  }

  return ((logs ?? []) as Array<{ id: string; reminder_id: string; taken_at: string }>).map((log) => ({
    id: log.id,
    taken_at: log.taken_at,
    title: titleByReminderId.get(log.reminder_id) ?? "リマインダー"
  })) as DoseLogHistoryEntry[];
}
