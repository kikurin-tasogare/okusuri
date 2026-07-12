import { supabase } from "./supabase.js";
import { decryptPrivateText, encryptPrivateText } from "./privacy.js";
import type { LineUserRow, ReminderAdminSummaryRow, ReminderCategory, ReminderKind, ReminderRow } from "./types.js";

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

export async function recordReminder(reminderId: string, lineUserId: string) {
  const { data: reminder, error: reminderError } = await supabase
    .from("reminders")
    .select("id, line_user_id")
    .eq("id", reminderId)
    .maybeSingle();

  if (reminderError) {
    throw reminderError;
  }

  if (!reminder || reminder.line_user_id !== lineUserId) {
    throw new Error("Reminder not found");
  }

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
    if (error.code === "42P01") {
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
    if (error.code === "42P01" || error.code === "23505") {
      return;
    }
    throw error;
  }
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
