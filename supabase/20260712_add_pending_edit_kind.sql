-- 「曜日を変える」用: pending_edits に編集の種類(時間 or 曜日)を持たせます。
alter table public.pending_edits
  add column if not exists kind text not null default 'time' check (kind in ('time', 'days'));
