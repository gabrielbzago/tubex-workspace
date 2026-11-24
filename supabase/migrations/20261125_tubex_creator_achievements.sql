-- TubeX Creator Achievements
-- Execute once in the Supabase SQL Editor before deploying the Workspace.
create table if not exists public.achievement_catalog (
  code text primary key,
  title text not null,
  description text not null,
  category text not null,
  metric text not null,
  threshold bigint not null default 0,
  tier text not null default 'bronze' check (tier in ('bronze','silver','gold','platinum')),
  points integer not null default 10,
  importance text not null default 'standard' check (importance in ('standard','important')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.creator_channel_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  channel_id text not null,
  channel_title text not null default '',
  channel_thumbnail text,
  subscriber_count bigint not null default 0,
  total_views bigint not null default 0,
  video_count bigint not null default 0,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists creator_channel_profiles_channel_idx on public.creator_channel_profiles(channel_id);

create table if not exists public.channel_metric_history (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  channel_id text not null,
  snapshot_date date not null,
  subscriber_count bigint not null default 0,
  total_views bigint not null default 0,
  video_count bigint not null default 0,
  source text not null default 'youtube_data_api',
  created_at timestamptz not null default now(),
  unique(user_id, channel_id, snapshot_date)
);
create index if not exists channel_metric_history_user_date_idx on public.channel_metric_history(user_id, snapshot_date desc);

create table if not exists public.user_achievements (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  channel_id text not null,
  achievement_code text not null references public.achievement_catalog(code),
  unlocked_at timestamptz not null default now(),
  achieved_value bigint not null default 0,
  evidence jsonb not null default '{}'::jsonb,
  email_notified_at timestamptz,
  unique(user_id, channel_id, achievement_code)
);
create index if not exists user_achievements_user_idx on public.user_achievements(user_id, unlocked_at desc);

create table if not exists public.achievement_goals (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  channel_id text not null,
  metric text not null,
  title text not null,
  target_value bigint not null,
  baseline_value bigint not null default 0,
  current_value bigint not null default 0,
  status text not null default 'active' check (status in ('active','completed','paused')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists achievement_goals_user_idx on public.achievement_goals(user_id, status);

create table if not exists public.achievement_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_enabled boolean not null default true,
  weekly_digest_enabled boolean not null default true,
  important_email_enabled boolean not null default true,
  timezone text not null default 'America/Sao_Paulo',
  last_digest_sent_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.achievement_email_logs (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  kind text not null,
  achievement_code text,
  period_start date,
  period_end date,
  status text not null,
  provider_id text,
  error text,
  created_at timestamptz not null default now()
);

alter table public.achievement_catalog enable row level security;
alter table public.creator_channel_profiles enable row level security;
alter table public.channel_metric_history enable row level security;
alter table public.user_achievements enable row level security;
alter table public.achievement_goals enable row level security;
alter table public.achievement_preferences enable row level security;
alter table public.achievement_email_logs enable row level security;

drop policy if exists "achievement catalog readable" on public.achievement_catalog;
create policy "achievement catalog readable" on public.achievement_catalog for select to authenticated using (active = true);
drop policy if exists "own achievement profile read" on public.creator_channel_profiles;
create policy "own achievement profile read" on public.creator_channel_profiles for select to authenticated using (auth.uid() = user_id);
drop policy if exists "own achievement history read" on public.channel_metric_history;
create policy "own achievement history read" on public.channel_metric_history for select to authenticated using (auth.uid() = user_id);
drop policy if exists "own achievements read" on public.user_achievements;
create policy "own achievements read" on public.user_achievements for select to authenticated using (auth.uid() = user_id);
drop policy if exists "own goals manage" on public.achievement_goals;
create policy "own goals manage" on public.achievement_goals for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own preferences manage" on public.achievement_preferences;
create policy "own preferences manage" on public.achievement_preferences for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own email logs read" on public.achievement_email_logs;
create policy "own email logs read" on public.achievement_email_logs for select to authenticated using (auth.uid() = user_id);

insert into public.achievement_catalog(code,title,description,category,metric,threshold,tier,points,importance)
values
('subs_100','Primeiros 100 inscritos','Seu canal alcançou 100 inscritos.','subscribers','subscriber_count',100,'bronze',25,'important'),
('subs_500','500 inscritos','Seu canal alcançou 500 inscritos.','subscribers','subscriber_count',500,'silver',50,'important'),
('subs_1000','1.000 inscritos','Seu canal alcançou mil inscritos.','subscribers','subscriber_count',1000,'gold',100,'important'),
('subs_5000','5.000 inscritos','Seu canal alcançou 5 mil inscritos.','subscribers','subscriber_count',5000,'gold',150,'important'),
('subs_10000','10 mil inscritos','Seu canal alcançou 10 mil inscritos.','subscribers','subscriber_count',10000,'platinum',250,'important'),
('subs_50000','50 mil inscritos','Seu canal alcançou 50 mil inscritos.','subscribers','subscriber_count',50000,'platinum',400,'important'),
('subs_100000','100 mil inscritos','Seu canal alcançou 100 mil inscritos.','subscribers','subscriber_count',100000,'platinum',600,'important'),
('views_1000','1.000 visualizações','Seu canal ultrapassou mil visualizações acumuladas.','views','total_views',1000,'bronze',25,'standard'),
('views_10000','10 mil visualizações','Seu canal ultrapassou 10 mil visualizações acumuladas.','views','total_views',10000,'silver',50,'standard'),
('views_100000','100 mil visualizações','Seu canal ultrapassou 100 mil visualizações acumuladas.','views','total_views',100000,'gold',100,'important'),
('views_1000000','1 milhão de visualizações','Seu canal ultrapassou um milhão de visualizações acumuladas.','views','total_views',1000000,'platinum',300,'important'),
('videos_10','10 vídeos publicados','Você publicou 10 vídeos.','publishing','video_count',10,'bronze',25,'standard'),
('videos_50','50 vídeos publicados','Você publicou 50 vídeos.','publishing','video_count',50,'silver',50,'standard'),
('videos_100','100 vídeos publicados','Você publicou 100 vídeos.','publishing','video_count',100,'gold',100,'important'),
('videos_500','500 vídeos publicados','Você publicou 500 vídeos.','publishing','video_count',500,'platinum',250,'important')
on conflict(code) do update set title=excluded.title,description=excluded.description,category=excluded.category,metric=excluded.metric,threshold=excluded.threshold,tier=excluded.tier,points=excluded.points,importance=excluded.importance,active=true;
