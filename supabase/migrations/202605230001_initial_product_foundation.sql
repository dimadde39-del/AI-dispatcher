create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.masters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null unique,
  city text not null default 'Almaty',
  trade_type text not null,
  telegram_chat_id text,
  status text not null default 'DRAFT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint masters_trade_type_check check (
    trade_type in (
      'PLUMBING',
      'WASHING_MACHINE_REPAIR',
      'FRIDGE_REPAIR',
      'ELECTRICIAN',
      'LOCKSMITH',
      'CONDITIONER',
      'OTHER'
    )
  ),
  constraint masters_status_check check (
    status in (
      'DRAFT',
      'READY_FOR_FORWARDING',
      'TRIAL',
      'ACTIVE',
      'PAUSED',
      'CHURNED'
    )
  )
);

create table if not exists public.assistant_profiles (
  id uuid primary key default gen_random_uuid(),
  master_id uuid not null references public.masters(id) on delete cascade,
  display_name text not null,
  language text not null default 'ru',
  prompt_version text not null default 'v1',
  voice_provider text not null default 'vapi',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_numbers (
  id uuid primary key default gen_random_uuid(),
  phone_number text not null unique,
  provider text not null,
  provider_number_id text,
  master_id uuid references public.masters(id),
  status text not null default 'AVAILABLE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_numbers_status_check check (
    status in ('AVAILABLE', 'ASSIGNED', 'DISABLED')
  )
);

create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  master_id uuid references public.masters(id),
  provider text not null,
  provider_call_id text not null,
  customer_phone text,
  ai_number text,
  status text not null default 'STARTED',
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds int,
  transcript text,
  recording_url text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, provider_call_id),
  constraint calls_status_check check (
    status in ('STARTED', 'ENDED', 'PROCESSED', 'FAILED', 'NO_LEAD')
  ),
  constraint calls_duration_seconds_check check (
    duration_seconds is null or duration_seconds >= 0
  )
);

create table if not exists public.call_events (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  master_id uuid not null references public.masters(id),
  call_id uuid references public.calls(id),
  customer_name text,
  customer_phone text,
  problem text not null,
  address text,
  urgency text not null,
  ai_summary text not null,
  ai_score text not null default 'WARM',
  safety_flag text not null default 'NONE',
  status text not null default 'NEW',
  accepted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leads_urgency_check check (
    urgency in ('LOW', 'MEDIUM', 'HIGH', 'EMERGENCY')
  ),
  constraint leads_ai_score_check check (
    ai_score in ('COLD', 'WARM', 'HOT', 'SPAM')
  ),
  constraint leads_safety_flag_check check (
    safety_flag in ('NONE', 'GAS', 'FIRE', 'ELECTRIC_DANGER')
  ),
  constraint leads_status_check check (
    status in (
      'NEW',
      'ACCEPTED',
      'CALLBACK_PENDING',
      'COMPLETED',
      'LOST',
      'SPAM'
    )
  )
);

create table if not exists public.lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.telegram_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  master_id uuid references public.masters(id) on delete cascade,
  chat_id text not null,
  message_id text not null,
  message_type text not null,
  created_at timestamptz not null default now(),
  unique(chat_id, message_id)
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  master_id uuid not null references public.masters(id) on delete cascade,
  status text not null default 'TRIAL',
  plan_code text not null default 'SOLO',
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_status_check check (
    status in ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED')
  )
);

create table if not exists public.value_reports (
  id uuid primary key default gen_random_uuid(),
  master_id uuid not null references public.masters(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  total_calls int not null default 0,
  captured_leads int not null default 0,
  accepted_leads int not null default 0,
  estimated_saved_revenue_min int not null default 0,
  estimated_saved_revenue_max int not null default 0,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint value_reports_period_check check (period_end >= period_start),
  constraint value_reports_counts_check check (
    total_calls >= 0 and
    captured_leads >= 0 and
    accepted_leads >= 0 and
    estimated_saved_revenue_min >= 0 and
    estimated_saved_revenue_max >= estimated_saved_revenue_min
  )
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null default 'system',
  actor_id text,
  event_type text not null,
  entity_type text,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists masters_status_idx on public.masters(status);
create index if not exists masters_trade_type_idx on public.masters(trade_type);
create index if not exists masters_created_at_idx on public.masters(created_at desc);

create index if not exists assistant_profiles_master_id_idx on public.assistant_profiles(master_id);
create index if not exists assistant_profiles_active_idx on public.assistant_profiles(is_active);

create index if not exists ai_numbers_master_id_idx on public.ai_numbers(master_id);
create index if not exists ai_numbers_status_idx on public.ai_numbers(status);
create index if not exists ai_numbers_created_at_idx on public.ai_numbers(created_at desc);

create index if not exists calls_master_id_idx on public.calls(master_id);
create index if not exists calls_status_idx on public.calls(status);
create index if not exists calls_created_at_idx on public.calls(created_at desc);
create index if not exists calls_provider_call_id_idx on public.calls(provider, provider_call_id);

create index if not exists call_events_call_id_idx on public.call_events(call_id);
create index if not exists call_events_event_type_idx on public.call_events(event_type);
create index if not exists call_events_created_at_idx on public.call_events(created_at desc);

create index if not exists leads_master_id_idx on public.leads(master_id);
create index if not exists leads_call_id_idx on public.leads(call_id);
create index if not exists leads_status_idx on public.leads(status);
create index if not exists leads_created_at_idx on public.leads(created_at desc);

create index if not exists lead_events_lead_id_idx on public.lead_events(lead_id);
create index if not exists lead_events_event_type_idx on public.lead_events(event_type);
create index if not exists lead_events_created_at_idx on public.lead_events(created_at desc);

create index if not exists telegram_messages_lead_id_idx on public.telegram_messages(lead_id);
create index if not exists telegram_messages_master_id_idx on public.telegram_messages(master_id);
create index if not exists telegram_messages_created_at_idx on public.telegram_messages(created_at desc);

create index if not exists subscriptions_master_id_idx on public.subscriptions(master_id);
create index if not exists subscriptions_status_idx on public.subscriptions(status);

create index if not exists value_reports_master_id_idx on public.value_reports(master_id);
create index if not exists value_reports_period_idx on public.value_reports(period_start, period_end);
create index if not exists value_reports_created_at_idx on public.value_reports(created_at desc);

create index if not exists audit_logs_entity_idx on public.audit_logs(entity_type, entity_id);
create index if not exists audit_logs_event_type_idx on public.audit_logs(event_type);
create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at desc);

drop trigger if exists set_masters_updated_at on public.masters;
create trigger set_masters_updated_at
before update on public.masters
for each row execute function public.set_updated_at();

drop trigger if exists set_assistant_profiles_updated_at on public.assistant_profiles;
create trigger set_assistant_profiles_updated_at
before update on public.assistant_profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_ai_numbers_updated_at on public.ai_numbers;
create trigger set_ai_numbers_updated_at
before update on public.ai_numbers
for each row execute function public.set_updated_at();

drop trigger if exists set_calls_updated_at on public.calls;
create trigger set_calls_updated_at
before update on public.calls
for each row execute function public.set_updated_at();

drop trigger if exists set_leads_updated_at on public.leads;
create trigger set_leads_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

drop trigger if exists set_subscriptions_updated_at on public.subscriptions;
create trigger set_subscriptions_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();
