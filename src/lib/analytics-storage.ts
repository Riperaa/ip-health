import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type AnalyticsEventRecord = {
  event_name:
    | "analyze_started"
    | "analyze_completed"
    | "compare_started"
    | "feedback_helpful"
    | "feedback_not_helpful";
  success: boolean | null;
  country_code: string | null;
  network_identity_category: string | null;
  evidence_quality: string | null;
  feedback_reason: string | null;
};

let supabaseClient: SupabaseClient | null | undefined;

function getSupabaseClient() {
  if (supabaseClient !== undefined) {
    return supabaseClient;
  }

  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    supabaseClient = null;
    return supabaseClient;
  }

  supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return supabaseClient;
}

export async function storeAnalyticsEvent(record: AnalyticsEventRecord) {
  const client = getSupabaseClient();

  if (!client) {
    return;
  }

  const { error } = await client.from("analytics_events").insert(record);

  if (error) {
    throw error;
  }
}
