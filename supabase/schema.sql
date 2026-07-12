create extension if not exists "pgcrypto";

create table if not exists public.line_users (
  line_user_id text primary key,
  linked_at timestamptz not null default now()
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  time text not null check (time ~ '^\d{2}:\d{2}$'),
  days_of_week int[] null,
  enabled boolean not null default true,
  action_label text not null check (action_label in ('飲んだよ', 'やったよ')),
  kind text not null check (kind in ('drink', 'task')),
  category text not null default 'other' check (category in ('drink', 'medicine', 'supplement', 'other')),
  line_user_id text not null references public.line_users(line_user_id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.dose_logs (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid not null references public.reminders(id) on delete cascade,
  taken_at timestamptz not null,
  status text not null default 'taken' check (status = 'taken'),
  created_at timestamptz not null default now()
);

create table if not exists public.reminder_send_logs (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid not null references public.reminders(id) on delete cascade,
  scheduled_key text not null,
  sent_at timestamptz not null default now(),
  unique (reminder_id, scheduled_key)
);

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
  kind text not null default 'time' check (kind in ('time', 'days')),
  created_at timestamptz not null default now()
);

-- title には reminders.title と同じく暗号化した値を保存します。
create table if not exists public.pending_registrations (
  line_user_id text primary key references public.line_users(line_user_id) on delete cascade,
  title text not null,
  time text null,
  days_of_week int[] null,
  created_at timestamptz not null default now()
);

alter table public.line_users enable row level security;
alter table public.reminders enable row level security;
alter table public.dose_logs enable row level security;
alter table public.reminder_send_logs enable row level security;
alter table public.reminder_snoozes enable row level security;
alter table public.pending_edits enable row level security;
alter table public.pending_registrations enable row level security;
