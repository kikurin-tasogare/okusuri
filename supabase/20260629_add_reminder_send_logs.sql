create table if not exists public.reminder_send_logs (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid not null references public.reminders(id) on delete cascade,
  scheduled_key text not null,
  sent_at timestamptz not null default now(),
  unique (reminder_id, scheduled_key)
);

alter table public.reminder_send_logs enable row level security;
