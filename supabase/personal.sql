-- myNexus personal data (tasks, calendar events, recents). Each row belongs to one account; only you can see yours.
-- Paste into Supabase > SQL Editor > New query > Run. Run once, after schema.sql.

create table public.tasks (
  id uuid primary key,
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  notes text not null default '',
  due_date date,
  due_time text,
  priority int not null default 0,
  done boolean not null default false,
  done_at bigint,
  created_at bigint
);

create table public.events (
  id uuid primary key,
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  notes text not null default '',
  ev_date date not null,
  all_day boolean not null default false,
  start_time text,
  end_time text,
  color int not null default 1
);

-- Small per-account values (recent activity, future settings)
create table public.user_kv (
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  key text not null,
  value jsonb,
  updated_at timestamptz default now(),
  primary key (owner, key)
);

alter table public.tasks enable row level security;
alter table public.events enable row level security;
alter table public.user_kv enable row level security;

create policy "own tasks" on public.tasks for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy "own events" on public.events for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy "own values" on public.user_kv for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());

alter publication supabase_realtime add table public.tasks, public.events, public.user_kv;
