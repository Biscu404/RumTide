-- Rumtide schema (section 15.3). Every engine interface becomes a table with snake case columns.
-- Nothing here is writable from the browser: row level security and grants are in 0003. All game
-- writes come from Edge Functions using the service role, through the functions in 0002.
--
-- Ids that the engine makes up (NPCs, battles, log events) are only unique within a season, so
-- those tables are keyed by (season_id, id). Captains, fleets and seasons get real uuids.

create table seasons (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  status          text not null check (status in ('draft', 'active', 'ended')),
  map_id          text not null,
  timezone        text not null,
  tide_time_local text not null check (tide_time_local ~ '^\d{1,2}:\d{2}$'),
  length_tides    int  not null check (length_tides > 0),
  current_tide    int  not null default 1,
  settings        jsonb not null,
  created_at      timestamptz not null default now()
);
-- One running season at a time. The Edge Functions play "the active season".
create unique index one_active_season on seasons ((true)) where status = 'active';

create table tides (
  season_id    uuid not null references seasons (id) on delete cascade,
  number       int  not null,
  status       text not null check (status in ('open', 'resolving', 'resolved', 'failed')),
  due_at       timestamptz not null,
  resolved_at  timestamptz,
  -- Fixed when the Tide opens, so a retry resolves it exactly the same way. Never shown to players.
  seed         bigint not null,
  boom_port_id text,
  gazette      jsonb,
  error        text,
  primary key (season_id, number)
);

create table fleets (
  id            uuid primary key default gen_random_uuid(),
  season_id     uuid not null references seasons (id) on delete cascade,
  name          text not null,
  flag          text not null,
  colour        text not null,
  created_tide  int  not null
);

create table captains (
  id                uuid primary key default gen_random_uuid(),
  season_id         uuid not null references seasons (id) on delete cascade,
  user_id           uuid not null references auth.users (id) on delete cascade,
  ship_name         text not null,
  flag              text not null,
  parting_shot      text not null default '',
  legend            double precision not null default 0 check (legend >= 0),
  chest_gold        double precision not null check (chest_gold >= 0),
  bounty            double precision not null default 0 check (bounty >= 0),
  shield_until_tide int,
  fleet_id          uuid references fleets (id) on delete set null,
  standing_plan     jsonb not null,
  standing_parley   jsonb not null,
  shore_leave_tides int  not null default 0,
  last_orders_tide  int  not null default 0,
  status            text not null default 'active' check (status in ('active', 'ashore')),
  -- Bumped by every write. A port action made against an old version is refused (compare and swap).
  version           int  not null default 0,
  unique (season_id, user_id)
);
create index captains_season on captains (season_id);

create table fleet_members (
  fleet_id         uuid not null references fleets (id) on delete cascade,
  captain_id       uuid not null references captains (id) on delete cascade,
  joined_tide      int  not null,
  leaving_at_tide  int,
  primary key (fleet_id, captain_id)
);

create table ships (
  captain_id           uuid primary key references captains (id) on delete cascade,
  hull                 text not null check (hull in ('sloop', 'brigantine', 'frigate')),
  node_id              text not null,
  docked               boolean not null,
  hull_points          double precision not null check (hull_points > 0),
  levels               jsonb not null,
  plunder_gold         double precision not null default 0 check (plunder_gold >= 0),
  cargo                jsonb not null,
  cargo_cost_basis     jsonb not null,
  shipwright_progress  double precision not null default 0 check (shipwright_progress >= 0)
);

create table orders (
  season_id          uuid not null references seasons (id) on delete cascade,
  tide               int  not null,
  captain_id         uuid not null references captains (id) on delete cascade,
  course             jsonb not null,
  intent             text not null check (intent in ('trade', 'quiet', 'hunt', 'explore', 'escort')),
  hunt_filter        jsonb,
  escort_captain_id  uuid references captains (id) on delete set null,
  plan               jsonb not null,
  parley             jsonb not null,
  no_quarter         boolean not null,
  ready              boolean not null,
  updated_at         timestamptz not null default now(),
  primary key (season_id, tide, captain_id)
);

create table npcs (
  season_id     uuid not null references seasons (id) on delete cascade,
  id            text not null,
  kind          text not null check (kind in ('smallTrader', 'fatMerchant', 'galleon')),
  node_id       text not null,
  pr            double precision not null,
  habit         jsonb not null,
  cargo_units   int  not null,
  spawned_tide  int  not null,
  status        text not null check (status in ('active', 'taken', 'gone')),
  primary key (season_id, id)
);

create table market (
  season_id       uuid not null references seasons (id) on delete cascade,
  port_id         text not null,
  good            text not null check (good in ('rum', 'sugar', 'spice')),
  drift           double precision not null check (drift > 0 and drift <= 1),
  sold_this_tide  int  not null default 0,
  primary key (season_id, port_id, good)
);

create table battles (
  season_id       uuid not null references seasons (id) on delete cascade,
  id              text not null,
  tide            int  not null,
  node_id         text not null,
  sides           jsonb not null,
  rounds          jsonb not null,
  outcome         text not null check (outcome in ('decisive', 'victory', 'draw')),
  winner          int check (winner in (0, 1)),
  loot            jsonb not null,
  bounties_added  jsonb not null,
  primary key (season_id, id)
);
create index battles_tide on battles (season_id, tide);

create table log_events (
  season_id   uuid not null references seasons (id) on delete cascade,
  id          text not null,
  tide        int  not null,
  captain_id  uuid references captains (id) on delete set null,
  visibility  text not null check (visibility in ('public', 'fleet', 'private')),
  kind        text not null,
  text        text not null,
  data        jsonb,
  primary key (season_id, id)
);
create index log_events_tide on log_events (season_id, tide);

-- The audit trail: every change to a Chest, for debugging and for charts.
create table transactions (
  id             bigint generated always as identity primary key,
  season_id      uuid not null references seasons (id) on delete cascade,
  captain_id     uuid not null references captains (id) on delete cascade,
  tide           int  not null,
  kind           text not null,
  amount         double precision not null,
  balance_after  double precision not null,
  data           jsonb,
  created_at     timestamptz not null default now()
);
create index transactions_captain on transactions (captain_id, tide);
