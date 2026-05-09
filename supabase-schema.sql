create extension if not exists pgcrypto;

create table if not exists public.admin_emails (
  email text primary key,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  event_type text not null default 'Event',
  starts_at timestamptz,
  ends_at timestamptz,
  location text,
  venue_note text,
  hero_image_url text,
  card_image_url text,
  short_description text,
  full_description text,
  speakers jsonb not null default '[]'::jsonb,
  schedule jsonb not null default '[]'::jsonb,
  gallery_images jsonb not null default '[]'::jsonb,
  is_paid boolean not null default false,
  ticket_price numeric(10,2),
  registration_url text,
  live_url text,
  show_on_homepage boolean not null default true,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
before update on public.events
for each row execute function public.set_updated_at();

alter table public.admin_emails enable row level security;
alter table public.events enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_emails
    where email = auth.jwt() ->> 'email'
  );
$$;

drop policy if exists "Published events are public" on public.events;
create policy "Published events are public"
on public.events for select
using (published = true);

drop policy if exists "Admins can read all events" on public.events;
create policy "Admins can read all events"
on public.events for select
using (public.is_admin());

drop policy if exists "Admins can insert events" on public.events;
create policy "Admins can insert events"
on public.events for insert
with check (public.is_admin());

drop policy if exists "Admins can update events" on public.events;
create policy "Admins can update events"
on public.events for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete events" on public.events;
create policy "Admins can delete events"
on public.events for delete
using (public.is_admin());

-- Replace this with the real admin email, then run it once in Supabase SQL Editor.
-- insert into public.admin_emails (email) values ('admin@example.com')
-- on conflict (email) do nothing;
