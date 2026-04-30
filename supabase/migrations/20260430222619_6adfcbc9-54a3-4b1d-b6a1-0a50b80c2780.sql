
-- ============ EXTENSIONS ============
create extension if not exists vector;

-- ============ ENUMS ============
create type public.app_role as enum ('student', 'tutor', 'admin');
create type public.booking_status as enum ('pending', 'confirmed', 'cancelled', 'completed', 'no_show');
create type public.payment_status as enum ('pending', 'marked_paid', 'confirmed', 'disputed');
create type public.payment_method_type as enum ('blik', 'iban', 'revolut', 'paypal', 'other');
create type public.circle_role as enum ('owner', 'mentor', 'member');
create type public.peer_request_status as enum ('open', 'matched', 'resolved', 'cancelled');

-- ============ PROFILES ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  display_name text,
  avatar_url text,
  bio text,
  ui_language text not null default 'pl',
  timezone text not null default 'Europe/Warsaw',
  karma_points integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- ============ USER ROLES ============
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique(user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists(select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- ============ TRIGGERS ============
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  -- default role: student
  insert into public.user_roles (user_id, role) values (new.id, 'student');
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ============ SUBJECTS ============
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_pl text not null,
  name_en text not null,
  category text,
  created_at timestamptz not null default now()
);
alter table public.subjects enable row level security;

insert into public.subjects (slug, name_pl, name_en, category) values
  ('math', 'Matematyka', 'Mathematics', 'science'),
  ('physics', 'Fizyka', 'Physics', 'science'),
  ('chemistry', 'Chemia', 'Chemistry', 'science'),
  ('biology', 'Biologia', 'Biology', 'science'),
  ('cs', 'Informatyka', 'Computer Science', 'science'),
  ('programming', 'Programowanie', 'Programming', 'tech'),
  ('english', 'Angielski', 'English', 'language'),
  ('german', 'Niemiecki', 'German', 'language'),
  ('spanish', 'Hiszpański', 'Spanish', 'language'),
  ('polish', 'Polski', 'Polish', 'language'),
  ('history', 'Historia', 'History', 'humanities'),
  ('philosophy', 'Filozofia', 'Philosophy', 'humanities'),
  ('music', 'Muzyka', 'Music', 'arts'),
  ('art', 'Sztuka', 'Art', 'arts');

-- ============ TUTOR PROFILES ============
create table public.tutor_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  headline text,
  description text,
  hourly_rate_cents integer not null default 0,
  currency text not null default 'PLN',
  years_experience integer default 0,
  intro_video_url text,
  is_verified boolean not null default false,
  is_published boolean not null default false,
  rating numeric(3,2) default 0,
  sessions_completed integer not null default 0,
  payment_reliability numeric(5,2) default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.tutor_profiles enable row level security;
create trigger tutor_profiles_touch before update on public.tutor_profiles
  for each row execute function public.touch_updated_at();

create table public.tutor_subjects (
  tutor_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  level text,
  primary key (tutor_id, subject_id)
);
alter table public.tutor_subjects enable row level security;

create table public.tutor_payment_methods (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references auth.users(id) on delete cascade,
  method_type payment_method_type not null,
  label text not null,
  details text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.tutor_payment_methods enable row level security;

create table public.tutor_availability (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references auth.users(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  start_minute integer not null check (start_minute between 0 and 1440),
  end_minute integer not null check (end_minute between 0 and 1440),
  created_at timestamptz not null default now()
);
alter table public.tutor_availability enable row level security;

-- ============ BOOKINGS / SESSIONS ============
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  tutor_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid references public.subjects(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status booking_status not null default 'pending',
  price_cents integer not null default 0,
  currency text not null default 'PLN',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.bookings enable row level security;
create trigger bookings_touch before update on public.bookings
  for each row execute function public.touch_updated_at();

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid unique references public.bookings(id) on delete cascade,
  room_name text not null unique,
  started_at timestamptz,
  ended_at timestamptz,
  recording_url text,
  created_at timestamptz not null default now()
);
alter table public.sessions enable row level security;

create table public.session_transcripts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  speaker_id uuid references auth.users(id),
  speaker_label text,
  text text not null,
  starts_at_ms integer not null default 0,
  ends_at_ms integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.session_transcripts enable row level security;
create index on public.session_transcripts (session_id, starts_at_ms);

create table public.session_emotions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  recorded_at timestamptz not null default now(),
  engagement numeric(4,3),
  confusion numeric(4,3),
  joy numeric(4,3),
  boredom numeric(4,3),
  raw jsonb
);
alter table public.session_emotions enable row level security;
create index on public.session_emotions (session_id, recorded_at);

create table public.session_reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid unique references public.sessions(id) on delete cascade,
  summary text,
  strengths text,
  weaknesses text,
  homework jsonb,
  flashcards jsonb,
  engagement_timeline jsonb,
  created_at timestamptz not null default now()
);
alter table public.session_reports enable row level security;

-- ============ PAYMENTS (no platform money) ============
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  student_id uuid not null references auth.users(id),
  tutor_id uuid not null references auth.users(id),
  amount_cents integer not null,
  currency text not null default 'PLN',
  method_type payment_method_type not null,
  method_details text not null,
  reference_code text not null,
  status payment_status not null default 'pending',
  marked_paid_at timestamptz,
  confirmed_at timestamptz,
  proof_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.payments enable row level security;
create trigger payments_touch before update on public.payments
  for each row execute function public.touch_updated_at();

-- ============ CIRCLES ============
create table public.circles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  topic text,
  is_public boolean not null default true,
  max_members integer not null default 6,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.circles enable row level security;

create table public.circle_members (
  circle_id uuid not null references public.circles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role circle_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);
alter table public.circle_members enable row level security;

create or replace function public.is_circle_member(_circle uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.circle_members where circle_id = _circle and user_id = _user) $$;

-- ============ PEER HELP / KARMA ============
create table public.peer_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  helper_id uuid references auth.users(id),
  subject_id uuid references public.subjects(id),
  title text not null,
  description text,
  status peer_request_status not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
alter table public.peer_requests enable row level security;

create table public.karma_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  delta integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);
alter table public.karma_events enable row level security;

-- ============ FLASHCARDS / SECOND BRAIN ============
create table public.flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete set null,
  front text not null,
  back text not null,
  ease numeric(4,2) default 2.5,
  due_at timestamptz default now(),
  created_at timestamptz not null default now()
);
alter table public.flashcards enable row level security;

create table public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete set null,
  circle_id uuid references public.circles(id) on delete set null,
  content text not null,
  embedding vector(1536),
  created_at timestamptz not null default now()
);
alter table public.knowledge_chunks enable row level security;

-- ============ HELPER: is participant of booking/session ============
create or replace function public.is_booking_participant(_booking uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists(select 1 from public.bookings where id = _booking and (student_id = _user or tutor_id = _user))
$$;

create or replace function public.is_session_participant(_session uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists(
    select 1 from public.sessions s
    join public.bookings b on b.id = s.booking_id
    where s.id = _session and (b.student_id = _user or b.tutor_id = _user)
  )
$$;

-- ============ RLS POLICIES ============

-- profiles: anyone authenticated can read; only owner can update
create policy "profiles select" on public.profiles for select to authenticated using (true);
create policy "profiles update own" on public.profiles for update to authenticated using (auth.uid() = id);
create policy "profiles insert own" on public.profiles for insert to authenticated with check (auth.uid() = id);

-- user_roles: user reads own roles; admin reads all
create policy "user_roles select own" on public.user_roles for select to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "user_roles admin manage" on public.user_roles for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "user_roles insert self student" on public.user_roles for insert to authenticated with check (auth.uid() = user_id and role in ('student','tutor'));

-- subjects: read all, admin manage
create policy "subjects read" on public.subjects for select to authenticated using (true);
create policy "subjects admin" on public.subjects for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- tutor_profiles: published readable by all auth, owner full
create policy "tutor read published" on public.tutor_profiles for select to authenticated using (is_published or user_id = auth.uid());
create policy "tutor manage own" on public.tutor_profiles for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "tutor_subjects read" on public.tutor_subjects for select to authenticated using (true);
create policy "tutor_subjects manage own" on public.tutor_subjects for all to authenticated using (auth.uid() = tutor_id) with check (auth.uid() = tutor_id);

create policy "tutor_avail read" on public.tutor_availability for select to authenticated using (true);
create policy "tutor_avail manage own" on public.tutor_availability for all to authenticated using (auth.uid() = tutor_id) with check (auth.uid() = tutor_id);

-- payment methods: only tutor sees own; students see only via payments row (separate select policy)
create policy "pm own" on public.tutor_payment_methods for all to authenticated using (auth.uid() = tutor_id) with check (auth.uid() = tutor_id);
create policy "pm read after booking" on public.tutor_payment_methods for select to authenticated using (
  exists(select 1 from public.bookings b where b.tutor_id = tutor_payment_methods.tutor_id and b.student_id = auth.uid() and b.status in ('confirmed','completed'))
);

-- bookings
create policy "bookings participants read" on public.bookings for select to authenticated using (auth.uid() = student_id or auth.uid() = tutor_id);
create policy "bookings student create" on public.bookings for insert to authenticated with check (auth.uid() = student_id);
create policy "bookings participants update" on public.bookings for update to authenticated using (auth.uid() = student_id or auth.uid() = tutor_id);

-- sessions
create policy "sessions participants read" on public.sessions for select to authenticated using (public.is_session_participant(id, auth.uid()));
create policy "sessions participants insert" on public.sessions for insert to authenticated with check (public.is_booking_participant(booking_id, auth.uid()));
create policy "sessions participants update" on public.sessions for update to authenticated using (public.is_session_participant(id, auth.uid()));

-- transcripts
create policy "transcripts read" on public.session_transcripts for select to authenticated using (public.is_session_participant(session_id, auth.uid()));
create policy "transcripts insert" on public.session_transcripts for insert to authenticated with check (public.is_session_participant(session_id, auth.uid()));

-- emotions
create policy "emotions read" on public.session_emotions for select to authenticated using (public.is_session_participant(session_id, auth.uid()));
create policy "emotions insert own" on public.session_emotions for insert to authenticated with check (auth.uid() = user_id and public.is_session_participant(session_id, auth.uid()));

-- reports
create policy "reports read" on public.session_reports for select to authenticated using (public.is_session_participant(session_id, auth.uid()));
create policy "reports insert" on public.session_reports for insert to authenticated with check (public.is_session_participant(session_id, auth.uid()));
create policy "reports update" on public.session_reports for update to authenticated using (public.is_session_participant(session_id, auth.uid()));

-- payments
create policy "payments participants read" on public.payments for select to authenticated using (auth.uid() = student_id or auth.uid() = tutor_id);
create policy "payments student create" on public.payments for insert to authenticated with check (auth.uid() = student_id);
create policy "payments participants update" on public.payments for update to authenticated using (auth.uid() = student_id or auth.uid() = tutor_id);

-- circles
create policy "circles read public or member" on public.circles for select to authenticated using (is_public or public.is_circle_member(id, auth.uid()));
create policy "circles create" on public.circles for insert to authenticated with check (auth.uid() = created_by);
create policy "circles owner update" on public.circles for update to authenticated using (auth.uid() = created_by);
create policy "circles owner delete" on public.circles for delete to authenticated using (auth.uid() = created_by);

create policy "cm read members" on public.circle_members for select to authenticated using (public.is_circle_member(circle_id, auth.uid()) or exists(select 1 from public.circles c where c.id = circle_id and c.is_public));
create policy "cm join self" on public.circle_members for insert to authenticated with check (auth.uid() = user_id);
create policy "cm leave self" on public.circle_members for delete to authenticated using (auth.uid() = user_id);

-- peer requests
create policy "peer read" on public.peer_requests for select to authenticated using (true);
create policy "peer create own" on public.peer_requests for insert to authenticated with check (auth.uid() = requester_id);
create policy "peer update own" on public.peer_requests for update to authenticated using (auth.uid() = requester_id or auth.uid() = helper_id);

-- karma
create policy "karma read own" on public.karma_events for select to authenticated using (auth.uid() = user_id);

-- flashcards
create policy "fc own all" on public.flashcards for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- knowledge_chunks
create policy "kc own read" on public.knowledge_chunks for select to authenticated using (
  auth.uid() = user_id or (circle_id is not null and public.is_circle_member(circle_id, auth.uid()))
);
create policy "kc own write" on public.knowledge_chunks for insert to authenticated with check (auth.uid() = user_id);
create policy "kc own delete" on public.knowledge_chunks for delete to authenticated using (auth.uid() = user_id);
