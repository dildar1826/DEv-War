-- ============================================================
-- DevWar — Supabase Database Setup
-- Run this entire file in the Supabase SQL Editor
-- ============================================================

-- 1. PROFILES
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  avatar_url text default '',
  total_xp integer default 0,
  level integer default 0,
  current_streak integer default 0,
  longest_streak integer default 0,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- 2. DAILY LOGS
create table if not exists public.daily_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  log_date date default current_date not null,
  hours numeric(4,1) default 0 not null check (hours >= 0 and hours <= 24),
  notes text default '',
  created_at timestamptz default now(),
  unique(user_id, log_date)
);

alter table public.daily_logs enable row level security;

create policy "Users can view their own logs"
  on public.daily_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert their own logs"
  on public.daily_logs for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own logs"
  on public.daily_logs for update
  using (auth.uid() = user_id);

create policy "Users can delete their own logs"
  on public.daily_logs for delete
  using (auth.uid() = user_id);

-- 3. TASKS
create table if not exists public.tasks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  completed boolean default false,
  task_date date default current_date,
  created_at timestamptz default now()
);

alter table public.tasks enable row level security;

create policy "Users can view their own tasks"
  on public.tasks for select
  using (auth.uid() = user_id);

create policy "Users can insert their own tasks"
  on public.tasks for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own tasks"
  on public.tasks for update
  using (auth.uid() = user_id);

create policy "Users can delete their own tasks"
  on public.tasks for delete
  using (auth.uid() = user_id);

-- 4. PROJECTS
create table if not exists public.projects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  description text default '',
  tech_stack text default '',
  url text default '',
  completed_at timestamptz default now(),
  created_at timestamptz default now()
);

alter table public.projects enable row level security;

create policy "Projects are viewable by everyone"
  on public.projects for select
  using (true);

create policy "Users can insert their own projects"
  on public.projects for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own projects"
  on public.projects for update
  using (auth.uid() = user_id);

create policy "Users can delete their own projects"
  on public.projects for delete
  using (auth.uid() = user_id);

-- 5. WARS
create table if not exists public.wars (
  id uuid default gen_random_uuid() primary key,
  challenger_id uuid references public.profiles(id) on delete cascade not null,
  opponent_id uuid references public.profiles(id) on delete cascade not null,
  status text default 'pending' check (status in ('pending','active','completed','declined')),
  winner_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  ended_at timestamptz
);

alter table public.wars enable row level security;

create policy "Wars are viewable by participants"
  on public.wars for select
  using (auth.uid() = challenger_id or auth.uid() = opponent_id);

create policy "Users can create wars"
  on public.wars for insert
  with check (auth.uid() = challenger_id);

create policy "Participants can update wars"
  on public.wars for update
  using (auth.uid() = challenger_id or auth.uid() = opponent_id);

-- 6. AUTO-CREATE PROFILE ON SIGNUP
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', 'user_' || left(new.id::text, 8)));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- Done! You should see 5 tables in the Table Editor.
-- ============================================================
