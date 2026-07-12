create table if not exists public.reminder_snoozes (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid not null references public.reminders(id) on delete cascade,
  line_user_id text not null references public.line_users(line_user_id) on delete cascade,
  remind_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.pending_edits (
  line_user_id text primary key references public.line_users(line_user_id) on delete cascade,
  reminder_id uuid not null references public.reminders(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.reminder_snoozes enable row level security;
alter table public.pending_edits enable row level security;
