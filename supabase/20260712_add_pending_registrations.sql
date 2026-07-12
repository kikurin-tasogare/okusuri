-- title には reminders.title と同じく暗号化した値を保存します。
create table if not exists public.pending_registrations (
  line_user_id text primary key references public.line_users(line_user_id) on delete cascade,
  title text not null,
  time text null,
  days_of_week int[] null,
  created_at timestamptz not null default now()
);

alter table public.pending_registrations enable row level security;
