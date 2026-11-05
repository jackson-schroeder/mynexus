-- myProjects v2: Timeline (milestones) and Updates (activity feed with per-person "seen" tracking).
-- Paste into Supabase > SQL Editor > New query > Run. Run once, after schema.sql.

create table public.milestones (
  id uuid primary key,
  project_id uuid not null references public.projects on delete cascade,
  title text not null,
  due date not null,
  done boolean not null default false,
  created_by uuid references public.profiles on delete set null,
  created_at timestamptz default now()
);

create table public.updates (
  id uuid primary key,
  project_id uuid not null references public.projects on delete cascade,
  user_id uuid references public.profiles on delete set null,
  text text not null,
  created_at timestamptz default now()
);

-- Which updates each person has actually seen (only rows they scrolled past get marked)
create table public.update_seen (
  id uuid primary key,
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  update_id uuid not null references public.updates on delete cascade,
  project_id uuid not null references public.projects on delete cascade,
  unique (user_id, update_id)
);

alter table public.milestones enable row level security;
alter table public.updates enable row level security;
alter table public.update_seen enable row level security;

create policy "milestones read" on public.milestones for select to authenticated using (is_member(project_id));
create policy "milestones write" on public.milestones for all to authenticated
  using (has_perm(project_id, 'edit_cards')) with check (has_perm(project_id, 'edit_cards'));

create policy "updates read" on public.updates for select to authenticated using (is_member(project_id));
create policy "updates add" on public.updates for insert to authenticated with check (is_member(project_id) and user_id = auth.uid());

create policy "seen own" on public.update_seen for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

alter publication supabase_realtime add table public.milestones, public.updates;
