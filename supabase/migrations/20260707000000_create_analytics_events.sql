create extension if not exists pgcrypto;

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_name text not null check (
    event_name in (
      'analyze_started',
      'analyze_completed',
      'compare_started',
      'feedback_helpful',
      'feedback_not_helpful'
    )
  ),
  success boolean,
  country_code text check (
    country_code is null
    or country_code = 'Unknown'
    or country_code ~ '^[A-Z]{2}$'
  ),
  network_identity_category text check (
    network_identity_category is null
    or network_identity_category in (
      'Residential ISP',
      'Mobile Network',
      'Enterprise Network',
      'Public Infrastructure',
      'Cloud Provider',
      'Datacenter',
      'VPN / Proxy',
      'Tor Exit',
      'Unknown'
    )
  ),
  evidence_quality text check (
    evidence_quality is null
    or evidence_quality in ('High', 'Medium', 'Low', 'Pending')
  ),
  feedback_reason text check (
    feedback_reason is null
    or feedback_reason in (
      'Wrong IP type',
      'Wrong location',
      'Score not convincing',
      'Missing information',
      'Other'
    )
  )
);

alter table public.analytics_events enable row level security;

create index if not exists analytics_events_created_at_idx
  on public.analytics_events (created_at desc);

create index if not exists analytics_events_event_name_idx
  on public.analytics_events (event_name);
