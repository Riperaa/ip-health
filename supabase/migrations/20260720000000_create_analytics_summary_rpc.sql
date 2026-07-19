create or replace function public.get_analytics_summary()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with event_counts as (
    select
      count(*)::bigint as total_events,
      count(*) filter (where event_name = 'analyze_started')::bigint as analyze_started,
      count(*) filter (where event_name = 'analyze_completed')::bigint as analyze_completed,
      count(*) filter (
        where event_name = 'analyze_completed'
          and (created_at at time zone 'UTC')::date = (now() at time zone 'UTC')::date
      )::bigint as today_analyze_completed,
      count(*) filter (
        where event_name = 'analyze_completed'
          and (created_at at time zone 'UTC')::date >= (now() at time zone 'UTC')::date - 6
      )::bigint as last_seven_days_analyze_completed,
      count(*) filter (where event_name = 'compare_started')::bigint as compare_started,
      count(*) filter (where event_name = 'feedback_helpful')::bigint as helpful_feedback,
      count(*) filter (where event_name = 'feedback_not_helpful')::bigint as not_helpful_feedback
    from public.analytics_events
  ),
  day_series as (
    select generate_series(
      (now() at time zone 'UTC')::date - 6,
      (now() at time zone 'UTC')::date,
      interval '1 day'
    )::date as day
  ),
  day_counts as (
    select
      (created_at at time zone 'UTC')::date as day,
      count(*)::bigint as count
    from public.analytics_events
    where (created_at at time zone 'UTC')::date >= (now() at time zone 'UTC')::date - 6
    group by 1
  ),
  events_by_day as (
    select jsonb_agg(
      jsonb_build_object(
        'date', to_char(day_series.day, 'YYYY-MM-DD'),
        'count', coalesce(day_counts.count, 0)
      )
      order by day_series.day
    ) as value
    from day_series
    left join day_counts using (day)
  ),
  completed_by_country as (
    select coalesce(
      jsonb_agg(jsonb_build_object('label', label, 'count', count) order by count desc, label),
      '[]'::jsonb
    ) as value
    from (
      select country_code as label, count(*)::bigint as count
      from public.analytics_events
      where event_name = 'analyze_completed' and country_code is not null
      group by country_code
    ) buckets
  ),
  completed_by_identity as (
    select coalesce(
      jsonb_agg(jsonb_build_object('label', label, 'count', count) order by count desc, label),
      '[]'::jsonb
    ) as value
    from (
      select network_identity_category as label, count(*)::bigint as count
      from public.analytics_events
      where event_name = 'analyze_completed' and network_identity_category is not null
      group by network_identity_category
    ) buckets
  ),
  completed_by_quality as (
    select coalesce(
      jsonb_agg(jsonb_build_object('label', label, 'count', count) order by count desc, label),
      '[]'::jsonb
    ) as value
    from (
      select evidence_quality as label, count(*)::bigint as count
      from public.analytics_events
      where event_name = 'analyze_completed' and evidence_quality is not null
      group by evidence_quality
    ) buckets
  ),
  negative_reasons as (
    select coalesce(
      jsonb_agg(jsonb_build_object('label', label, 'count', count) order by count desc, label),
      '[]'::jsonb
    ) as value
    from (
      select feedback_reason as label, count(*)::bigint as count
      from public.analytics_events
      where event_name = 'feedback_not_helpful' and feedback_reason is not null
      group by feedback_reason
    ) buckets
  )
  select jsonb_build_object(
    'totalEvents', event_counts.total_events,
    'analyzeStartedCount', event_counts.analyze_started,
    'analyzeCompletedCount', event_counts.analyze_completed,
    'todayAnalyzeCompletedCount', event_counts.today_analyze_completed,
    'lastSevenDaysAnalyzeCompletedCount', event_counts.last_seven_days_analyze_completed,
    'analyzeCompletionRate', case
      when event_counts.analyze_started = 0 then null
      else round(event_counts.analyze_completed::numeric / event_counts.analyze_started * 100, 1)
    end,
    'compareStartedCount', event_counts.compare_started,
    'helpfulFeedbackCount', event_counts.helpful_feedback,
    'notHelpfulFeedbackCount', event_counts.not_helpful_feedback,
    'feedbackVoteCount', event_counts.helpful_feedback + event_counts.not_helpful_feedback,
    'negativeFeedbackCount', event_counts.not_helpful_feedback,
    'feedbackHelpfulRate', case
      when event_counts.helpful_feedback + event_counts.not_helpful_feedback = 0 then null
      else round(
        event_counts.helpful_feedback::numeric /
        (event_counts.helpful_feedback + event_counts.not_helpful_feedback) * 100,
        1
      )
    end,
    'eventsByDay', events_by_day.value,
    'analyzeCompletedByCountry', completed_by_country.value,
    'analyzeCompletedByNetworkIdentityCategory', completed_by_identity.value,
    'analyzeCompletedByEvidenceQuality', completed_by_quality.value,
    'negativeFeedbackReasons', negative_reasons.value
  )
  from event_counts
  cross join events_by_day
  cross join completed_by_country
  cross join completed_by_identity
  cross join completed_by_quality
  cross join negative_reasons;
$$;

revoke all on function public.get_analytics_summary() from public;
revoke all on function public.get_analytics_summary() from anon;
revoke all on function public.get_analytics_summary() from authenticated;
grant execute on function public.get_analytics_summary() to service_role;
