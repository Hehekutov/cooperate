create table if not exists public.companies (
    id text primary key,
    name text not null,
    inn text not null,
    description text null,
    created_at timestamptz not null,
    idea_monthly_limit integer not null,
    vote_approval_percent integer not null
);

create table if not exists public.user_accounts (
    id text primary key,
    company_id text not null references public.companies(id) on delete cascade,
    full_name text not null,
    login text not null,
    phone text not null,
    role text not null,
    position text not null,
    avatar_url text null,
    password_hash text not null,
    is_active boolean not null,
    created_at timestamptz not null
);

create table if not exists public.ideas (
    id text primary key,
    company_id text not null references public.companies(id) on delete cascade,
    author_id text not null references public.user_accounts(id) on delete cascade,
    voting_type text not null,
    title text not null,
    description text not null,
    status text not null,
    moderation_comment text null,
    moderated_at timestamptz null,
    moderated_by text null references public.user_accounts(id) on delete set null,
    voting_opened_at timestamptz null,
    voting_closed_at timestamptz null,
    director_review_requested_at timestamptz null,
    director_decision_at timestamptz null,
    director_decision_by text null references public.user_accounts(id) on delete set null,
    director_comment text null,
    archived_at timestamptz null,
    created_at timestamptz not null,
    updated_at timestamptz not null
);

create table if not exists public.idea_voting_eligible_users (
    idea_id text not null references public.ideas(id) on delete cascade,
    user_id text not null references public.user_accounts(id) on delete cascade,
    primary key (idea_id, user_id)
);

create table if not exists public.idea_votes (
    id text primary key,
    idea_id text not null references public.ideas(id) on delete cascade,
    user_id text not null references public.user_accounts(id) on delete cascade,
    value text not null,
    created_at timestamptz not null,
    unique (idea_id, user_id)
);

create table if not exists public.app_sessions (
    id text primary key,
    user_id text not null references public.user_accounts(id) on delete cascade,
    token text not null unique,
    created_at timestamptz not null,
    expires_at timestamptz not null
);

create unique index if not exists user_accounts_login_key on public.user_accounts (login);
create unique index if not exists user_accounts_phone_key on public.user_accounts (phone);
create index if not exists user_accounts_company_id_idx on public.user_accounts (company_id);
create index if not exists ideas_company_id_idx on public.ideas (company_id);
create index if not exists ideas_author_id_idx on public.ideas (author_id);
create index if not exists ideas_status_idx on public.ideas (status);
create index if not exists idea_votes_idea_id_idx on public.idea_votes (idea_id);
create index if not exists app_sessions_user_id_idx on public.app_sessions (user_id);
create index if not exists app_sessions_expires_at_idx on public.app_sessions (expires_at);

alter table public.companies enable row level security;
alter table public.user_accounts enable row level security;
alter table public.ideas enable row level security;
alter table public.idea_voting_eligible_users enable row level security;
alter table public.idea_votes enable row level security;
alter table public.app_sessions enable row level security;

revoke all on table public.companies from anon, authenticated;
revoke all on table public.user_accounts from anon, authenticated;
revoke all on table public.ideas from anon, authenticated;
revoke all on table public.idea_voting_eligible_users from anon, authenticated;
revoke all on table public.idea_votes from anon, authenticated;
revoke all on table public.app_sessions from anon, authenticated;

comment on table public.companies is 'Application companies';
comment on table public.user_accounts is 'Application users including directors, admins, and employees';
comment on table public.ideas is 'Ideas submitted by employees and admins';
comment on table public.idea_voting_eligible_users is 'Snapshot of users allowed to vote on each idea';
comment on table public.idea_votes is 'Votes for ideas';
comment on table public.app_sessions is 'Backend-issued sessions';
