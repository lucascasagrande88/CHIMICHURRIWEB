-- Apply once as postgres on the CHIMI BRAIN project. Requires Vault, pg_net and pgcrypto (extensions).
-- Provision the generated network token separately, with the same value in both runtimes.
-- The sole switch lives in chimi_voice.settings.enabled. Ship disabled.
-- Only an operator with DB privileges can request a call or change the switch.
-- Requests use fixed HTTPS routes and never accept a phone number or arbitrary URL.
create schema chimi_voice authorization postgres;
revoke all on schema chimi_voice from public, anon, authenticated, service_role;

create table chimi_voice.settings (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false
);
insert into chimi_voice.settings default values;
create table chimi_voice.calls (
  request_id uuid primary key,
  agent text not null,
  topic text not null,
  reserved_at timestamptz not null default clock_timestamp(),
  call_sid text unique,
  claimed_at timestamptz
);
create index chimi_voice_calls_reserved_idx on chimi_voice.calls (reserved_at desc);
create table chimi_voice.dispatches (
  net_id bigint primary key,
  kind text not null check (kind in ('check', 'call')),
  ticket uuid not null unique,
  payload jsonb,
  queued_at timestamptz not null default clock_timestamp(),
  consumed_at timestamptz
);
revoke all on all tables in schema chimi_voice from public, anon, authenticated, service_role;
alter table chimi_voice.settings enable row level security;
alter table chimi_voice.calls enable row level security;
alter table chimi_voice.dispatches enable row level security;

create function chimi_voice.valid_request(p_id uuid, p_agent text, p_topic text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(
    p_id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and length(p_agent) between 1 and 64 and p_agent = btrim(p_agent)
    and p_agent !~ '[[:cntrl:]]'
    and length(p_topic) between 1 and 300 and p_topic = btrim(p_topic)
    and p_topic !~ '[[:cntrl:]]', false);
$$;

create function public.chimi_voice_ledger(
  p_token text, p_op text, p_id uuid default null, p_agent text default null,
  p_topic text default null, p_sid text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  expected text;
  armed boolean;
  context jsonb;
begin
  select decrypted_secret into expected from vault.decrypted_secrets where name = 'chimi_call_network_v1';
  if expected is null or length(expected) < 32 or p_token is null or length(p_token) > 512 or
     sha256(convert_to(p_token, 'UTF8')) <> sha256(convert_to(expected, 'UTF8')) then
    raise insufficient_privilege using message = 'access_denied';
  end if;
  if p_op in ('state','status') then
    select enabled into strict armed from chimi_voice.settings where singleton;
    return jsonb_build_object('enabled', armed);
  end if;

  if p_op in ('take_check','take_call') then
    -- SELECT FOR UPDATE rechecks currency under contention. The UPDATE scrubs
    -- the private payload in the same statement that returns its prior value.
    with valid as materialized (
      select ticket, payload from chimi_voice.dispatches
      where ticket = p_id and kind = substr(p_op, 6) and consumed_at is null
        and queued_at > clock_timestamp() - interval '60 seconds'
      for update
    )
    update chimi_voice.dispatches d set consumed_at = clock_timestamp(), payload = null
      from valid where d.ticket = valid.ticket
      returning valid.payload into context;
    return context;
  end if;

  if p_op = 'reserve' then
    -- This singleton row serializes quotas, duplicate detection and concurrent disarming.
    select enabled into strict armed from chimi_voice.settings where singleton for update;
    if not armed or not chimi_voice.valid_request(p_id, p_agent, p_topic)
      or exists (select 1 from chimi_voice.calls where request_id = p_id)
      or exists (select 1 from chimi_voice.calls where reserved_at > clock_timestamp() - interval '6 minutes')
      or (select count(*) from chimi_voice.calls where reserved_at > clock_timestamp() - interval '24 hours') >= 4
    then return jsonb_build_object('reserved', false); end if;
    update chimi_voice.calls set topic = '' where topic <> '' and reserved_at < clock_timestamp() - interval '6 minutes';
    insert into chimi_voice.calls (request_id, agent, topic) values (p_id, p_agent, p_topic);
    return jsonb_build_object('reserved', true);
  end if;

  if p_op = 'bind' then
    if p_sid is null or p_sid !~ '^CA[0-9a-fA-F]{32}$' then return jsonb_build_object('ok', false); end if;
    update chimi_voice.calls set call_sid = p_sid
    where request_id = p_id and (call_sid is null or call_sid = p_sid)
      and reserved_at > clock_timestamp() - interval '2 minutes';
    return jsonb_build_object('ok', found);
  end if;

  if p_op = 'claim' then
    select enabled into strict armed from chimi_voice.settings where singleton for share;
    if not armed or p_sid is null or p_sid !~ '^CA[0-9a-fA-F]{32}$' then return null; end if;
    -- Early media can race the REST create response. Caller may retry until bound.
    update chimi_voice.calls set claimed_at = clock_timestamp()
    where request_id = p_id and call_sid = p_sid and claimed_at is null
      and reserved_at > clock_timestamp() - interval '2 minutes'
    returning jsonb_build_object('agent', agent, 'topic', topic) into context;
    if context is not null then update chimi_voice.calls set topic = '' where request_id = p_id; end if;
    return context;
  end if;
  raise invalid_parameter_value using message = 'unknown_operation';
end;
$$;
revoke all on function public.chimi_voice_ledger(text,text,uuid,text,text,text)
  from public, anon, authenticated, service_role;
grant execute on function public.chimi_voice_ledger(text,text,uuid,text,text,text) to anon;

create function chimi_voice.dispatch(p_kind text, p_payload jsonb)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare
  secret text;
  ticket_id uuid := gen_random_uuid();
  signature text;
  job bigint;
begin
  if p_kind is null or p_kind not in ('check','call') then raise invalid_parameter_value; end if;
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'chimi_call_network_v1';
  if secret is null or length(secret) < 32 then
    raise object_not_in_prerequisite_state using message = 'network_token_missing';
  end if;
  -- The worker starts after COMMIT. Its shared queue gets no credentials,
  -- phone number, topic or agent context. A signed ticket is scoped to one
  -- pre-authorized dispatch, one fixed route, and a one-minute redemption.
  signature := encode(extensions.hmac(p_kind || ':' || ticket_id::text, secret, 'sha256'), 'hex');
  job := net.http_post(
    url := 'https://chimichurriweb.vercel.app/api/chimi-call/' || p_kind,
    body := jsonb_build_object('ticket',ticket_id,'signature',signature),
    headers := '{"Content-Type":"application/json"}'::jsonb,
    timeout_milliseconds := 35000
  );
  update chimi_voice.dispatches set payload = null
    where payload is not null and consumed_at is null and queued_at <= clock_timestamp() - interval '60 seconds';
  insert into chimi_voice.dispatches (net_id, kind, ticket, payload)
    values (job, p_kind, ticket_id, p_payload);
  return job;
end;
$$;

create function chimi_voice.check_setup()
returns bigint language sql security invoker set search_path = '' as $$
  select chimi_voice.dispatch('check', '{}'::jsonb);
$$;
create function chimi_voice.request_call(p_request_id uuid, p_agent text, p_topic text)
returns bigint language plpgsql security invoker set search_path = '' as $$
begin
  if not chimi_voice.valid_request(p_request_id, p_agent, p_topic) then
    raise invalid_parameter_value using message = 'invalid_request';
  end if;
  if not (select enabled from chimi_voice.settings where singleton) then
    raise object_not_in_prerequisite_state using message = 'outbound_disabled';
  end if;
  return chimi_voice.dispatch('call', jsonb_build_object('requestId',p_request_id,'agent',p_agent,'topic',p_topic));
end;
$$;

-- Operator-only, safe even when the remote service responds with framework HTML,
-- private debugging information, credentials, or arbitrary unexpected JSON.
-- The result is a deliberately small subset of the network response.
create function chimi_voice.request_result(p_net_id bigint)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  reply record;
  payload jsonb;
  checks jsonb;
  detail jsonb := '{}'::jsonb;
begin
  if not exists (select 1 from chimi_voice.dispatches where net_id = p_net_id) then
    return jsonb_build_object('state','unknown_request');
  end if;
  select status_code, timed_out, content into reply from net._http_response where id = p_net_id;
  if not found then return jsonb_build_object('state','pending_or_expired'); end if;
  begin
    payload := reply.content::jsonb;
  exception when invalid_text_representation then payload := null;
  end;
  if jsonb_typeof(payload->'ready') = 'boolean' then detail := jsonb_build_object('ready',payload->'ready'); end if;
  if jsonb_typeof(payload->'enabled') = 'boolean' then detail := detail || jsonb_build_object('enabled',payload->'enabled'); end if;
  if jsonb_typeof(payload->'checks') = 'object' then
    select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into checks
      from jsonb_each_text(payload->'checks')
      where key in ('twilioCredentials','openaiKey','ownerMobile','voiceFrom','mediaAddress','twilioAccount',
        'ownedVoiceNumber','argentinaLowRisk','voiceModelVisible','ledger') and
        value in ('ok','missing','missing_or_invalid','not_checked','access_denied','not_found','unknown',
        'trial','inactive_or_unknown','disabled','not_eligible','inventory_incomplete','one_available',
        'multiple_available','none_available');
    detail := detail || jsonb_build_object('checks',checks);
  end if;
  if payload->>'status' = 'submitted' then detail := detail || '{"status":"submitted"}'::jsonb; end if;
  if payload->>'error' in ('invalid_request','outbound_disabled','preflight_blocked','duplicate_or_rate_limited',
    'reservation_unavailable','twilio_rejected','outcome_unknown_do_not_retry',
    'ledger_unavailable','call_submitted_link_unknown_do_not_retry','operation_unavailable_do_not_retry') then
    detail := detail || jsonb_build_object('error', payload->>'error');
  end if;
  if payload->>'callSid' ~ '^CA[0-9a-fA-F]{32}$' then detail := detail || jsonb_build_object('callSid',payload->>'callSid'); end if;
  return jsonb_build_object('state','received','httpStatus',reply.status_code,'timedOut',reply.timed_out) || detail;
end;
$$;

revoke all on all functions in schema chimi_voice from public, anon, authenticated, service_role;
-- Only the migration owner/postgres retains execution on these private functions.
-- The public RPC receives a publishable API key at the gateway and verifies its
-- separate private token server-side for every operation.
notify pgrst, 'reload schema';
