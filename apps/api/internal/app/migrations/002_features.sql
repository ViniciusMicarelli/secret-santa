create table if not exists recovery_codes(user_id bigint not null references users(id) on delete cascade, code_hash text primary key, created_at timestamptz not null default now());
alter table wishes add column if not exists favorite boolean not null default false;
create unique index if not exists one_favorite_wish on wishes(group_id,user_id) where favorite;
create table if not exists chat_reads(group_id bigint not null references groups(id) on delete cascade, giver bigint not null references users(id), user_id bigint not null references users(id), last_read_id bigint not null default 0, primary key(group_id,giver,user_id));
create table if not exists chat_reports(id bigserial primary key,group_id bigint not null references groups(id) on delete cascade,giver bigint not null references users(id),reporter bigint not null references users(id),reason text not null,created_at timestamptz not null default now());
create table if not exists rate_limits(key text primary key, count integer not null, window_start timestamptz not null);
