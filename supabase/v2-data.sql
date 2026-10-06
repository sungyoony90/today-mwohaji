-- Additive V2 model. Legacy groups/posts/reports/stamps are not modified.
create schema if not exists moa_private;
revoke all on schema moa_private from public, anon, authenticated;

create table public.moa_visits_v2 (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  place text not null check (char_length(place) between 1 and 100),
  description text not null default '' check (char_length(description) <= 100),
  region text not null default '' check (char_length(region) <= 80),
  spot_id text not null default '' check (char_length(spot_id) <= 120),
  custom boolean not null default false,
  address text not null default '' check (char_length(address) <= 200),
  place_coords jsonb,
  photo_path text not null unique,
  is_public boolean not null default false,
  moderation_status text not null default 'active' check (moderation_status in ('active', 'hidden')),
  created_at timestamptz not null default now(),
  constraint moa_photo_owner_path check (photo_path = user_id::text || '/' || id::text || '.jpg'),
  constraint moa_place_coords_object check (place_coords is null or jsonb_typeof(place_coords) = 'object')
);
create index moa_visits_owner_date on public.moa_visits_v2(user_id, created_at desc);
create index moa_visits_public_date on public.moa_visits_v2(created_at desc, id) where is_public and moderation_status = 'active';
alter table public.moa_visits_v2 enable row level security;
revoke all on public.moa_visits_v2 from anon, authenticated;
grant select on public.moa_visits_v2 to anon, authenticated;
grant insert (id, place, description, region, spot_id, custom, address, place_coords, photo_path, is_public) on public.moa_visits_v2 to authenticated;
grant update (is_public, description) on public.moa_visits_v2 to authenticated;
grant delete on public.moa_visits_v2 to authenticated;
create policy moa_visits_public_read on public.moa_visits_v2 for select to anon, authenticated using (is_public and moderation_status = 'active');
create policy moa_visits_owner_read on public.moa_visits_v2 for select to authenticated using ((select auth.uid()) = user_id);
create policy moa_visits_owner_insert on public.moa_visits_v2 for insert to authenticated with check ((select auth.uid()) = user_id);
create policy moa_visits_owner_update on public.moa_visits_v2 for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy moa_visits_owner_delete on public.moa_visits_v2 for delete to authenticated using ((select auth.uid()) = user_id);

create table public.moa_preferences_v2 (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  saved_spots text[] not null default '{}' check (cardinality(saved_spots) <= 500),
  saved_moments text[] not null default '{}' check (cardinality(saved_moments) <= 500),
  discovery_records jsonb not null default '[]' check (jsonb_typeof(discovery_records) = 'array' and jsonb_array_length(discovery_records) <= 365),
  moa_look text not null default 'explorer' check (char_length(moa_look) <= 50)
);
alter table public.moa_preferences_v2 enable row level security;
revoke all on public.moa_preferences_v2 from anon, authenticated;
grant select, insert, update, delete on public.moa_preferences_v2 to authenticated;
create policy moa_preferences_owner on public.moa_preferences_v2 for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create table public.moa_likes_v2 (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  moment_id text not null check (char_length(moment_id) between 1 and 120),
  created_at timestamptz not null default now(),
  primary key (user_id, moment_id)
);
alter table public.moa_likes_v2 enable row level security;
revoke all on public.moa_likes_v2 from anon, authenticated;
grant select, delete on public.moa_likes_v2 to authenticated;
grant insert (moment_id) on public.moa_likes_v2 to authenticated;
create policy moa_likes_owner on public.moa_likes_v2 for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create table public.moa_like_totals_v2 (
  moment_id text primary key,
  total integer not null default 0 check (total >= 0)
);
alter table public.moa_like_totals_v2 enable row level security;
revoke all on public.moa_like_totals_v2 from anon, authenticated;
grant select on public.moa_like_totals_v2 to anon, authenticated;
create policy moa_like_totals_read on public.moa_like_totals_v2 for select to anon, authenticated using (true);

create function moa_private.update_like_total_v2() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- auth.users cascade deletion is an administrative exception, not a client API.
  if current_user <> 'postgres' and (select auth.uid()) is null then raise exception 'authentication required'; end if;
  if TG_OP = 'INSERT' then
    if (select auth.uid()) is distinct from NEW.user_id then raise exception 'owner mismatch'; end if;
    insert into public.moa_like_totals_v2(moment_id,total) values (NEW.moment_id,1)
      on conflict(moment_id) do update set total = public.moa_like_totals_v2.total + 1;
    return NEW;
  end if;
  if (select auth.uid()) is not null and (select auth.uid()) is distinct from OLD.user_id then raise exception 'owner mismatch'; end if;
  update public.moa_like_totals_v2 set total = greatest(0,total-1) where moment_id = OLD.moment_id;
  return OLD;
end; $$;
revoke execute on function moa_private.update_like_total_v2() from public, anon, authenticated;
create trigger moa_like_totals_trigger after insert or delete on public.moa_likes_v2 for each row execute function moa_private.update_like_total_v2();

create function moa_private.limit_visits_v2() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.user_id::text,0));
  if (select count(*) from public.moa_visits_v2 where user_id = NEW.user_id and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'daily upload limit reached';
  end if;
  return NEW;
end; $$;
revoke execute on function moa_private.limit_visits_v2() from public, anon, authenticated;
create trigger moa_visit_limit before insert on public.moa_visits_v2 for each row execute function moa_private.limit_visits_v2();

create table public.moa_reports_v2 (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  moment_id text not null check (char_length(moment_id) between 1 and 120),
  reason text not null check (char_length(reason) between 1 and 300),
  created_at timestamptz not null default now(),
  primary key (user_id, moment_id)
);
alter table public.moa_reports_v2 enable row level security;
revoke all on public.moa_reports_v2 from anon, authenticated;
grant select on public.moa_reports_v2 to authenticated;
grant insert (moment_id,reason) on public.moa_reports_v2 to authenticated;
create policy moa_reports_insert on public.moa_reports_v2 for insert to authenticated with check ((select auth.uid()) = user_id);
create policy moa_reports_owner_read on public.moa_reports_v2 for select to authenticated using ((select auth.uid()) = user_id);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('moa-visits-v2','moa-visits-v2',false,5242880,array['image/jpeg']);
create policy moa_photo_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'moa-visits-v2' and (storage.foldername(name))[1] = (select auth.uid())::text and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$');
create policy moa_photo_owner_read on storage.objects for select to authenticated
  using (bucket_id = 'moa-visits-v2' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy moa_photo_public_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'moa-visits-v2' and exists(select 1 from public.moa_visits_v2 v where v.photo_path = name and v.is_public and v.moderation_status = 'active'));
create policy moa_photo_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'moa-visits-v2' and (storage.foldername(name))[1] = (select auth.uid())::text);
