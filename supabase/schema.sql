-- ST Console v2 — Supabase schema
-- Run this whole file ONCE: Supabase → SQL Editor → New query → paste → Run
-- (Safe to run again later; it will not delete or duplicate anything.)

create extension if not exists pgcrypto;

-- ---------- settings (always exactly one row) ----------
create table if not exists settings (
  id int primary key default 1,
  weekly_fee_per_member numeric not null default 120,
  venue_paid_per_attendee numeric not null default 90,
  visitor_fee numeric not null default 130,
  renewal_fee numeric not null default 0,
  active_members int not null default 0,
  careem_link text not null default '',
  bank_name text not null default '',
  bank_account_name text not null default '',
  bank_account_number text not null default '',
  bank_iban text not null default '',
  kitty_initial numeric not null default 0,
  constraint single_row check (id = 1)
);
insert into settings (id) values (1) on conflict (id) do nothing;

-- ---------- venue fee weekly entries ----------
create table if not exists venue_entries (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  attendance int not null default 0,
  visitors int not null default 0,
  note text default '',
  created_at timestamptz not null default now()
);

-- ---------- events ----------
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  date date not null,
  budget numeric not null default 0,
  note text default '',
  created_at timestamptz not null default now()
);

-- ---------- miscellaneous debits/credits ----------
create table if not exists misc_entries (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  type text not null check (type in ('debit','credit')),
  amount numeric not null,
  note text default '',
  invoice_url text default '',
  created_at timestamptz not null default now()
);

-- ---------- renewals member list ----------
create table if not exists renewal_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text default '',
  email text default '',
  renewal_date date,
  join_date date,
  created_at timestamptz not null default now()
);

-- ---------- members (Members page) ----------
create table if not exists fee_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company_name text default '',
  email text default '',
  phone text default '',
  active boolean not null default true,
  last_accrual_date date not null default current_date,
  created_at timestamptz not null default now()
);

-- ---------- member ledger (charges + payments) ----------
create table if not exists fee_ledger (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references fee_members(id) on delete cascade,
  date date not null,
  type text not null check (type in ('charge','payment')),
  category text not null check (category in ('meeting','social')),
  amount numeric not null,
  method text default '',
  note text default '',
  auto_key text,                       -- set only on automatic monthly meeting-fee charges
  created_at timestamptz not null default now()
);
create index if not exists fee_ledger_member_idx on fee_ledger(member_id);
-- The database itself refuses a second automatic charge for the same member + month:
create unique index if not exists fee_ledger_auto_key_uniq on fee_ledger(member_id, auto_key);

-- ---------- holidays (dates with no meeting) ----------
create table if not exists holidays (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  note text default '',
  created_at timestamptz not null default now()
);

-- ---------- Row Level Security ----------
-- Any signed-in user (a login you created in Supabase → Authentication) can read/write everything.
do $$
declare t text;
begin
  for t in select unnest(array['settings','venue_entries','events','misc_entries','renewal_members','fee_members','fee_ledger','holidays'])
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "authenticated full access" on %I', t);
    execute format('create policy "authenticated full access" on %I for all using (auth.role() = ''authenticated'') with check (auth.role() = ''authenticated'')', t);
  end loop;
end $$;
