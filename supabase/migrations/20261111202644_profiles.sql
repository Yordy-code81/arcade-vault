-- SPEC 02 — Player profiles linked to Supabase Auth users.

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text not null unique check (username ~ '^[A-Z0-9_]{3,10}$'),
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'Player profile (one per auth user). Written only by the on_auth_user_created trigger.';

alter table public.profiles enable row level security;

-- Public read: leaderboards (SPEC 04) show other players' names.
create policy "profiles are readable by everyone"
  on public.profiles for select
  to anon, authenticated
  using (true);

-- No insert/update/delete policies: only the trigger below writes.

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, upper(new.raw_user_meta_data ->> 'username'));
  return new;
end;
$$;

-- Only the trigger may run it; keep it off the exposed RPC API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
