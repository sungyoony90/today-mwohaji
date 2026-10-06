-- Additive identity binding. Existing user IDs, photos and records stay unchanged.
create table public.moa_toss_identity_v2 (
  key_digest text primary key check (key_digest ~ '^[0-9a-f]{64}$'),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.moa_toss_identity_v2 enable row level security;
revoke all on public.moa_toss_identity_v2 from public, anon, authenticated;
grant select, insert on public.moa_toss_identity_v2 to service_role;
-- No client policies. Only the verified server can read or claim a binding.

create table public.moa_identity_attempts_v2 (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null default now(),
  attempts integer not null default 1
);
alter table public.moa_identity_attempts_v2 enable row level security;
revoke all on public.moa_identity_attempts_v2 from public, anon, authenticated;
grant select, insert, update on public.moa_identity_attempts_v2 to service_role;

create function public.moa_take_identity_attempt_v2(owner uuid) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare attempts_now integer;
begin
  insert into public.moa_identity_attempts_v2(user_id) values (owner)
  on conflict(user_id) do update set
    attempts = case when moa_identity_attempts_v2.window_start < now() - interval '5 minutes'
      then 1 else moa_identity_attempts_v2.attempts + 1 end,
    window_start = case when moa_identity_attempts_v2.window_start < now() - interval '5 minutes'
      then now() else moa_identity_attempts_v2.window_start end
  returning attempts into attempts_now;
  return attempts_now <= 10;
end; $$;
revoke execute on function public.moa_take_identity_attempt_v2(uuid) from public, anon, authenticated;
grant execute on function public.moa_take_identity_attempt_v2(uuid) to service_role;
