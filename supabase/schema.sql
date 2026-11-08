-- Run this complete file in the Supabase SQL Editor as the project administrator.
-- No pets, clinical records, partners, offers, or other demonstration rows are inserted.
begin;

create or replace function public.is_verified_user()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.users where id = (select auth.uid()) and email_confirmed_at is not null);
$$;
revoke all on function public.is_verified_user() from public, anon;
grant execute on function public.is_verified_user() to authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 100),
  created_at timestamptz not null default now()
);
create table if not exists public.pets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  species text not null check (species in ('dog', 'cat')),
  gender text not null check (gender in ('female', 'male')),
  breed text not null check (char_length(btrim(breed)) between 1 and 100),
  birth_date date not null check (birth_date between date '1980-01-01' and current_date),
  weight_kg numeric(6,2) not null check (weight_kg between 0.05 and 200),
  microchip text check (microchip is null or char_length(microchip) <= 100),
  photo_path text not null check (photo_path like owner_id::text || '/pets/%'),
  created_at timestamptz not null default now(),
  unique (id, owner_id)
);
create table if not exists public.vaccinations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  pet_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  administered_on date not null check (administered_on <= current_date),
  due_on date check (due_on is null or due_on >= administered_on),
  clinic text not null default '' check (char_length(clinic) <= 160),
  notes text not null default '' check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  foreign key (pet_id, owner_id) references public.pets(id, owner_id) on delete cascade
);
create table if not exists public.vet_contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  pet_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  clinic text not null default '' check (char_length(clinic) <= 160),
  phone text not null check (char_length(phone) <= 32 and regexp_replace(phone, '[[:space:]().-]', '', 'g') ~ '^\+?[0-9]{7,15}$'),
  address text not null default '' check (char_length(address) <= 300),
  notes text not null default '' check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  foreign key (pet_id, owner_id) references public.pets(id, owner_id) on delete cascade
);
create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  pet_id uuid not null,
  caption text not null check (char_length(btrim(caption)) between 1 and 300),
  photo_path text not null check (photo_path like owner_id::text || '/memories/%'),
  taken_on date not null check (taken_on <= current_date),
  created_at timestamptz not null default now(),
  foreign key (pet_id, owner_id) references public.pets(id, owner_id) on delete cascade
);
create table if not exists public.partner_booths (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  category text not null check (category in ('clinic', 'shop')),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text not null check (char_length(description) <= 3000),
  image_url text check (image_url is null or image_url ~ '^https://'),
  website text check (website is null or website ~ '^https://'),
  address text not null default '' check (char_length(address) <= 300),
  offer_label text not null default '' check (char_length(offer_label) <= 60),
  species text[] not null default '{}' check (species <@ array['dog', 'cat']::text[]),
  breeds text[] not null default '{}',
  min_age_months integer not null default 0 check (min_age_months >= 0),
  max_age_months integer check (max_age_months is null or max_age_months >= min_age_months),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  is_active boolean not null default false,
  voucher_limit integer check (voucher_limit is null or voucher_limit > 0),
  created_at timestamptz not null default now(),
  check (expires_at is null or expires_at > starts_at)
);
create table if not exists public.user_vouchers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  pet_id uuid not null,
  booth_id uuid not null references public.partner_booths(id) on delete restrict,
  code text not null unique default replace(gen_random_uuid()::text, '-', ''),
  status text not null default 'active' check (status in ('active', 'redeemed', 'cancelled')),
  expires_at timestamptz,
  redeemed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (owner_id, booth_id),
  foreign key (pet_id, owner_id) references public.pets(id, owner_id) on delete cascade
);
create table if not exists public.walk_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  pet_id uuid not null,
  mood text not null check (mood in ('friendly', 'cautious')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  route jsonb not null default '[]'::jsonb check (jsonb_typeof(route) = 'array' and jsonb_array_length(route) <= 10000),
  distance_m numeric(12,2) not null default 0 check (distance_m >= 0),
  paw_coins integer generated always as (case when ended_at is not null then floor(distance_m / 10)::integer else 0 end) stored,
  foreign key (pet_id, owner_id) references public.pets(id, owner_id) on delete cascade,
  check (ended_at is null or ended_at >= started_at)
);
-- A real B2B inbox, separate from approved and published partner booths.
create table if not exists public.partner_applications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  business_name text not null check (char_length(btrim(business_name)) between 1 and 160),
  contact_name text not null check (char_length(btrim(contact_name)) between 1 and 160),
  email text not null check (char_length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  phone text not null check (char_length(phone) <= 32 and regexp_replace(phone, '[[:space:]().-]', '', 'g') ~ '^\+?[0-9]{7,15}$'),
  category text not null check (category in ('clinic', 'shop')),
  message text not null check (char_length(btrim(message)) between 10 and 3000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now()
);

create index if not exists pets_owner_idx on public.pets(owner_id);
create index if not exists vaccinations_pet_idx on public.vaccinations(owner_id, pet_id, due_on);
create index if not exists vet_contacts_pet_idx on public.vet_contacts(owner_id, pet_id);
create index if not exists memories_pet_idx on public.memories(owner_id, pet_id, taken_on desc);
create index if not exists vouchers_owner_idx on public.user_vouchers(owner_id, pet_id);
create index if not exists vouchers_booth_idx on public.user_vouchers(booth_id);
create index if not exists walks_pet_idx on public.walk_sessions(owner_id, pet_id, started_at desc);
create unique index if not exists one_active_walk_per_owner on public.walk_sessions(owner_id) where ended_at is null;
create index if not exists applications_owner_idx on public.partner_applications(owner_id);
create index if not exists booths_active_idx on public.partner_booths(is_active, starts_at, expires_at);

create or replace function public.create_profile_for_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.create_profile_for_auth_user() from public, anon, authenticated;
drop trigger if exists petlog_create_profile on auth.users;
create trigger petlog_create_profile after insert on auth.users for each row execute function public.create_profile_for_auth_user();
insert into public.profiles(id) select id from auth.users on conflict (id) do nothing;

alter table public.profiles enable row level security;
drop policy if exists profile_owner on public.profiles;
create policy profile_owner on public.profiles for all to authenticated
  using (id = (select auth.uid()) and (select public.is_verified_user()))
  with check (id = (select auth.uid()) and (select public.is_verified_user()));

do $$
declare target text;
begin
  foreach target in array array['pets','vaccinations','vet_contacts','memories','walk_sessions'] loop
    execute format('alter table public.%I enable row level security', target);
    execute format('drop policy if exists verified_owner on public.%I', target);
    execute format('create policy verified_owner on public.%I for all to authenticated using (owner_id = (select auth.uid()) and (select public.is_verified_user())) with check (owner_id = (select auth.uid()) and (select public.is_verified_user()))', target);
    execute format('revoke all on public.%I from anon, authenticated', target);
    execute format('grant select, insert, update, delete on public.%I to authenticated', target);
  end loop;
end;
$$;
revoke all on public.profiles from anon, authenticated;
grant select, insert, update on public.profiles to authenticated;

alter table public.partner_booths enable row level security;
drop policy if exists approved_booths on public.partner_booths;
create policy approved_booths on public.partner_booths for select to authenticated
  using ((select public.is_verified_user()) and (is_active or owner_id = (select auth.uid())));
revoke all on public.partner_booths from anon, authenticated;
grant select on public.partner_booths to authenticated;

alter table public.partner_applications enable row level security;
drop policy if exists applications_read on public.partner_applications;
drop policy if exists applications_insert on public.partner_applications;
create policy applications_read on public.partner_applications for select to authenticated
  using (owner_id = (select auth.uid()) and (select public.is_verified_user()));
create policy applications_insert on public.partner_applications for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select public.is_verified_user()) and status = 'pending');
revoke all on public.partner_applications from anon, authenticated;
grant select on public.partner_applications to authenticated;
grant insert (owner_id,business_name,contact_name,email,phone,category,message) on public.partner_applications to authenticated;

alter table public.user_vouchers enable row level security;
drop policy if exists vouchers_read on public.user_vouchers;
drop policy if exists vouchers_cancel on public.user_vouchers;
create policy vouchers_read on public.user_vouchers for select to authenticated
  using (owner_id = (select auth.uid()) and (select public.is_verified_user()));
create policy vouchers_cancel on public.user_vouchers for update to authenticated
  using (owner_id = (select auth.uid()) and (select public.is_verified_user()) and status = 'active')
  with check (owner_id = (select auth.uid()) and (select public.is_verified_user()) and status = 'cancelled');
revoke all on public.user_vouchers from anon, authenticated;
grant select on public.user_vouchers to authenticated;
grant update (status) on public.user_vouchers to authenticated;

-- Only this transaction can issue a voucher; locks prevent over-claiming stock.
create or replace function public.claim_voucher(p_booth_id uuid, p_pet_id uuid)
returns public.user_vouchers language plpgsql security definer set search_path = '' as $$
declare
  offer public.partner_booths;
  friend public.pets;
  result public.user_vouchers;
  age_in_months integer;
begin
  if not public.is_verified_user() then raise exception 'Verified email required' using errcode = '42501'; end if;
  select * into friend from public.pets where id = p_pet_id and owner_id = auth.uid();
  if not found then raise exception 'Pet access denied' using errcode = '42501'; end if;
  select * into offer from public.partner_booths where id = p_booth_id for update;
  if not found or not offer.is_active or offer.starts_at > now() or (offer.expires_at is not null and offer.expires_at <= now()) then raise exception 'offer unavailable'; end if;
  age_in_months := extract(year from age(current_date, friend.birth_date))::integer * 12 + extract(month from age(current_date, friend.birth_date))::integer;
  if (cardinality(offer.species) > 0 and not friend.species = any(offer.species))
    or (cardinality(offer.breeds) > 0 and not exists (select 1 from unnest(offer.breeds) as breed where lower(breed) = lower(friend.breed)))
    or age_in_months < offer.min_age_months or (offer.max_age_months is not null and age_in_months > offer.max_age_months)
  then raise exception 'offer unavailable for this pet'; end if;
  select * into result from public.user_vouchers where owner_id = auth.uid() and booth_id = offer.id;
  if found then return result; end if;
  if offer.voucher_limit is not null and (select count(*) from public.user_vouchers where booth_id = offer.id) >= offer.voucher_limit then raise exception 'voucher limit reached'; end if;
  insert into public.user_vouchers(owner_id, pet_id, booth_id, expires_at)
    values (auth.uid(), friend.id, offer.id, offer.expires_at) returning * into result;
  return result;
end;
$$;
revoke all on function public.claim_voucher(uuid,uuid) from public, anon;
grant execute on function public.claim_voucher(uuid,uuid) to authenticated;

-- A booth's assigned real operator can redeem an active code exactly once.
create or replace function public.redeem_voucher(p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result public.user_vouchers;
begin
  if not public.is_verified_user() then raise exception 'Verified email required' using errcode = '42501'; end if;
  select voucher.* into result from public.user_vouchers voucher
    join public.partner_booths booth on booth.id = voucher.booth_id
    where voucher.code = p_code and booth.owner_id = auth.uid() and booth.is_active for update of voucher;
  if not found or result.status <> 'active' or (result.expires_at is not null and result.expires_at <= now()) then raise exception 'voucher unavailable'; end if;
  update public.user_vouchers set status = 'redeemed', redeemed_at = now() where id = result.id;
  return jsonb_build_object('id', result.id, 'status', 'redeemed', 'booth_id', result.booth_id);
end;
$$;
revoke all on function public.redeem_voucher(text) from public, anon;
grant execute on function public.redeem_voucher(text) to authenticated;

-- Never trust a submitted distance or reward. Recalculate from the recorded GPS path.
create or replace function public.validate_walk()
returns trigger language plpgsql set search_path = '' as $$
declare
  point jsonb; previous jsonb; lat double precision; lng double precision;
  last_lat double precision; last_lng double precision; stamp numeric; last_stamp numeric;
  segment double precision; hav double precision; total double precision := 0;
  session_start numeric; session_end numeric;
begin
  if tg_op = 'INSERT' then
    new.started_at := clock_timestamp();
    if new.ended_at is not null or new.route <> '[]'::jsonb then raise exception 'Start with an empty walk'; end if;
  else
    if old.ended_at is not null then raise exception 'Finished walk is immutable'; end if;
    if new.id <> old.id or new.owner_id <> old.owner_id or new.pet_id <> old.pet_id or new.started_at <> old.started_at or new.mood <> old.mood then raise exception 'Walk identity is immutable'; end if;
    if jsonb_array_length(new.route) < jsonb_array_length(old.route) then raise exception 'Walk route is append only'; end if;
    if exists (select 1 from jsonb_array_elements(old.route) with ordinality as old_point(value, n) where new.route -> (old_point.n::integer - 1) is distinct from old_point.value) then raise exception 'Saved route cannot be rewritten'; end if;
  end if;
  if new.ended_at is not null then new.ended_at := clock_timestamp(); end if;
  session_start := extract(epoch from new.started_at) * 1000 - 30000;
  session_end := extract(epoch from coalesce(new.ended_at, clock_timestamp())) * 1000 + 30000;
  for point in select value from jsonb_array_elements(new.route) loop
    if jsonb_typeof(point) <> 'object' or not (point ?& array['lat','lng','timestamp','accuracy'])
      or jsonb_typeof(point->'lat') <> 'number' or jsonb_typeof(point->'lng') <> 'number'
      or jsonb_typeof(point->'timestamp') <> 'number' or jsonb_typeof(point->'accuracy') <> 'number'
      or (point ? 'segment_start' and jsonb_typeof(point->'segment_start') <> 'boolean')
    then raise exception 'Invalid GPS point'; end if;
    lat := (point->>'lat')::double precision; lng := (point->>'lng')::double precision; stamp := (point->>'timestamp')::numeric;
    if lat not between -90 and 90 or lng not between -180 and 180 or (point->>'accuracy')::numeric not between 0 and 50 or stamp not between session_start and session_end then raise exception 'Invalid GPS bounds, accuracy or timestamp'; end if;
    if previous is not null then
      if stamp - last_stamp < 1000 then raise exception 'GPS timestamps must increase'; end if;
      if coalesce((point->>'segment_start')::boolean, false) = false then
        hav := power(sin(radians(lat - last_lat) / 2), 2) + cos(radians(last_lat)) * cos(radians(lat)) * power(sin(radians(lng - last_lng) / 2), 2);
        segment := 6371000 * 2 * asin(sqrt(least(1::double precision, greatest(0::double precision, hav))));
        if segment / ((stamp - last_stamp) / 1000) > 5 then raise exception 'GPS movement exceeds walking speed'; end if;
        total := total + segment;
      end if;
    end if;
    previous := point; last_lat := lat; last_lng := lng; last_stamp := stamp;
  end loop;
  new.distance_m := trunc(total::numeric, 2);
  return new;
end;
$$;
revoke all on function public.validate_walk() from public, anon, authenticated;
drop trigger if exists validate_walk_before_save on public.walk_sessions;
create trigger validate_walk_before_save before insert or update on public.walk_sessions for each row execute function public.validate_walk();

-- Private uploads: only verified owners can access their own folder.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('pet-media','pet-media',false,8388608,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 8388608, allowed_mime_types = array['image/jpeg','image/png','image/webp'];
drop policy if exists pet_media_read on storage.objects;
drop policy if exists pet_media_insert on storage.objects;
drop policy if exists pet_media_delete on storage.objects;
create policy pet_media_read on storage.objects for select to authenticated
  using (bucket_id = 'pet-media' and (storage.foldername(name))[1] = (select auth.uid())::text and (select public.is_verified_user()));
create policy pet_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'pet-media' and (storage.foldername(name))[1] = (select auth.uid())::text
    and (storage.foldername(name))[2] in ('pets','memories') and (select public.is_verified_user()));
create policy pet_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'pet-media' and (storage.foldername(name))[1] = (select auth.uid())::text and (select public.is_verified_user())
    and not exists (select 1 from public.pets where photo_path = storage.objects.name)
    and not exists (select 1 from public.memories where photo_path = storage.objects.name));

-- A profile or memory must reference an actual uploaded object, never a sample URL.
create or replace function public.check_photo_object()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from storage.objects where bucket_id = 'pet-media' and name = new.photo_path)
  then raise exception 'Upload the real photo before saving'; end if;
  return new;
end;
$$;
revoke all on function public.check_photo_object() from public, anon, authenticated;
drop trigger if exists pets_real_photo on public.pets;
drop trigger if exists memories_real_photo on public.memories;
create trigger pets_real_photo before insert or update of photo_path on public.pets for each row execute function public.check_photo_object();
create trigger memories_real_photo before insert or update of photo_path on public.memories for each row execute function public.check_photo_object();

-- Supabase administrators manage approved partners; no public booth creation.
grant all on public.profiles, public.pets, public.vaccinations, public.vet_contacts, public.memories,
  public.partner_booths, public.user_vouchers, public.walk_sessions, public.partner_applications to service_role;
notify pgrst, 'reload schema';
commit;
