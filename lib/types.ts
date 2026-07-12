export type ReminderKind = "drink" | "task";
export type ReminderCategory = "drink" | "medicine" | "supplement" | "other";

export type ReminderRow = {
  id: string;
  title: string;
  time: string;
  days_of_week: number[] | null;
  enabled: boolean;
  action_label: string;
  kind: ReminderKind;
  category: ReminderCategory;
  line_user_id: string | null;
};

export type ReminderAdminSummaryRow = {
  id: string;
  enabled: boolean;
  category: ReminderCategory;
  line_user_id: string | null;
  created_at: string;
};

export type LineUserRow = {
  line_user_id: string;
  linked_at: string;
};

export type DoseLogStatus = "taken";

export type ReminderSendLogRow = {
  id: string;
  reminder_id: string;
  scheduled_key: string;
  sent_at: string;
};

export type ReminderSnoozeRow = {
  id: string;
  reminder_id: string;
  line_user_id: string;
  remind_at: string;
};

export type PendingEditKind = "time" | "days";

export type PendingEditRow = {
  line_user_id: string;
  reminder_id: string;
  created_at: string;
  // Absent while the kind column migration has not been applied yet.
  kind?: PendingEditKind | null;
};

export type PendingRegistrationRow = {
  line_user_id: string;
  title: string;
  time: string | null;
  days_of_week: number[] | null;
  created_at: string;
};

export type DoseLogHistoryEntry = {
  id: string;
  taken_at: string;
  title: string;
};
