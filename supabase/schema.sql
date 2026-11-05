-- myProjects database. Paste this whole file into Supabase > SQL Editor > New query > Run.
-- Safe to run once on a fresh project.

-- ---------- Tables ----------
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null check (username ~ '^[a-zA-Z0-9_]{3,20}$'),
  created_at timestamptz default now()
);

create table public.projects (
  id uuid primary key,
  name text not null,
  owner uuid not null references public.profiles on delete cascade,
  created_at timestamptz default now()
);

create table public.roles (
  id uuid primary key,
  project_id uuid not null references public.projects on delete cascade,
  name text not null,
  perms jsonb not null default '{}'
);

create table public.members (
  project_id uuid not null references public.projects on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  role_id uuid not null references public.roles on delete restrict,
  id uuid unique not null default gen_random_uuid(),
  primary key (project_id, user_id)
);

create table public.invites (
  id uuid primary key,
  project_id uuid not null references public.projects on delete cascade,
  project_name text not null,
  username text not null,
  role_id uuid not null references public.roles on delete cascade,
  invited_by uuid references public.profiles on delete set null,
  created_at timestamptz default now()
);

create table public.steps (
  id uuid primary key,
  project_id uuid not null references public.projects on delete cascade,
  name text not null,
  position double precision not null default 0
);

create table public.cards (
  id uuid primary key,
  project_id uuid not null references public.projects on delete cascade,
  step_id uuid not null references public.steps on delete cascade,
  title text not null,
  description text not null default '',
  assignees uuid[] not null default '{}',
  position double precision not null default 0,
  done boolean not null default false,
  created_by uuid references public.profiles on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.comments (
  id uuid primary key,
  project_id uuid not null references public.projects on delete cascade,
  card_id uuid not null references public.cards on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  body text not null,
  created_at timestamptz default now()
);

create table public.attachments (
  id uuid primary key,
  project_id uuid not null references public.projects on delete cascade,
  card_id uuid not null references public.cards on delete cascade,
  path text not null,
  name text not null,
  size bigint not null default 0,
  uploaded_by uuid references public.profiles on delete set null,
  created_at timestamptz default now()
);

-- ---------- Profile auto-created from the username given at sign-up ----------
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username) values (new.id, new.raw_user_meta_data->>'username');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Permission helpers ----------
create function public.is_member(p uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from projects where id = p and owner = auth.uid())
      or exists (select 1 from members where project_id = p and user_id = auth.uid());
$$;

-- Owner can do everything; everyone else gets what their role's perms allow.
create function public.has_perm(p uuid, perm text) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from projects where id = p and owner = auth.uid())
      or exists (select 1 from members m join roles r on r.id = m.role_id
                 where m.project_id = p and m.user_id = auth.uid() and (r.perms->>perm)::boolean);
$$;

create function public.my_username() returns text
language sql security definer stable set search_path = public as $$
  select username from profiles where id = auth.uid();
$$;

-- Card edits are split by permission: content / moving / completing.
create function public.enforce_card_update() returns trigger
language plpgsql set search_path = public as $$
begin
  if (new.title, new.description, new.assignees) is distinct from (old.title, old.description, old.assignees)
     and not has_perm(new.project_id, 'edit_cards') then raise exception 'No permission to edit cards'; end if;
  if (new.step_id, new.position) is distinct from (old.step_id, old.position)
     and not has_perm(new.project_id, 'move_cards') then raise exception 'No permission to move cards'; end if;
  if new.done is distinct from old.done
     and not has_perm(new.project_id, 'complete_cards') then raise exception 'No permission to complete cards'; end if;
  new.updated_at = now();
  return new;
end $$;
create trigger cards_enforce before update on public.cards
  for each row execute function public.enforce_card_update();

-- ---------- Row level security ----------
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.roles enable row level security;
alter table public.members enable row level security;
alter table public.invites enable row level security;
alter table public.steps enable row level security;
alter table public.cards enable row level security;
alter table public.comments enable row level security;
alter table public.attachments enable row level security;

create policy "profiles readable" on public.profiles for select to authenticated using (true);
create policy "profiles self update" on public.profiles for update to authenticated using (id = auth.uid());

create policy "projects read" on public.projects for select to authenticated using (is_member(id));
create policy "projects create" on public.projects for insert to authenticated with check (owner = auth.uid());
create policy "projects rename" on public.projects for update to authenticated using (has_perm(id, 'manage_roles'));
create policy "projects delete" on public.projects for delete to authenticated using (owner = auth.uid());

create policy "roles read" on public.roles for select to authenticated using (is_member(project_id));
create policy "roles write" on public.roles for all to authenticated
  using (has_perm(project_id, 'manage_roles')) with check (has_perm(project_id, 'manage_roles'));

create policy "members read" on public.members for select to authenticated using (is_member(project_id));
create policy "members add" on public.members for insert to authenticated with check (
  has_perm(project_id, 'manage_roles')
  or (user_id = auth.uid() and exists (select 1 from invites i
      where i.project_id = members.project_id and i.role_id = members.role_id and i.username = my_username())));
create policy "members change role" on public.members for update to authenticated using (has_perm(project_id, 'manage_roles'));
create policy "members remove" on public.members for delete to authenticated
  using (has_perm(project_id, 'manage_roles') or user_id = auth.uid());

create policy "invites read" on public.invites for select to authenticated
  using (is_member(project_id) or username = my_username());
create policy "invites create" on public.invites for insert to authenticated with check (has_perm(project_id, 'invite'));
create policy "invites remove" on public.invites for delete to authenticated
  using (has_perm(project_id, 'invite') or username = my_username());

create policy "steps read" on public.steps for select to authenticated using (is_member(project_id));
create policy "steps write" on public.steps for all to authenticated
  using (has_perm(project_id, 'edit_steps')) with check (has_perm(project_id, 'edit_steps'));

create policy "cards read" on public.cards for select to authenticated using (is_member(project_id));
create policy "cards create" on public.cards for insert to authenticated with check (has_perm(project_id, 'create_cards'));
create policy "cards update" on public.cards for update to authenticated using (is_member(project_id));
create policy "cards delete" on public.cards for delete to authenticated using (has_perm(project_id, 'delete_cards'));

create policy "comments read" on public.comments for select to authenticated using (is_member(project_id));
create policy "comments create" on public.comments for insert to authenticated
  with check (user_id = auth.uid() and has_perm(project_id, 'comment'));
create policy "comments own" on public.comments for delete to authenticated using (user_id = auth.uid());

create policy "attachments read" on public.attachments for select to authenticated using (is_member(project_id));
create policy "attachments add" on public.attachments for insert to authenticated with check (has_perm(project_id, 'attach_files'));
create policy "attachments remove" on public.attachments for delete to authenticated
  using (uploaded_by = auth.uid() or has_perm(project_id, 'delete_cards'));

-- ---------- File storage (private; only project members can read/upload) ----------
insert into storage.buckets (id, name, public) values ('attachments', 'attachments', false);
create policy "files read" on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy "files upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and public.has_perm(((storage.foldername(name))[1])::uuid, 'attach_files'));
create policy "files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and (owner = auth.uid() or public.has_perm(((storage.foldername(name))[1])::uuid, 'delete_cards')));

-- ---------- Live updates ----------
alter publication supabase_realtime add table public.projects, public.roles, public.members, public.invites,
  public.steps, public.cards, public.comments, public.attachments;
