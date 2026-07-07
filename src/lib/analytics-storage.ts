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

export type AnalyticsSupabaseEnvStatus = {
  SUPABASE_URL: boolean;
  SUPABASE_SERVICE_ROLE_KEY: boolean;
};

export class AnalyticsSupabaseConfigurationError extends Error {
  readonly envStatus: AnalyticsSupabaseEnvStatus;

  constructor(envStatus: AnalyticsSupabaseEnvStatus) {
    super("Supabase analytics environment variables are missing");
    this.name = "AnalyticsSupabaseConfigurationError";
    this.envStatus = envStatus;
  }
}

let supabaseClient: SupabaseClient | undefined;

export function getAnalyticsSupabaseEnvStatus(): AnalyticsSupabaseEnvStatus {
  return {
    SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };
}

function getSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return null;
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
    throw new AnalyticsSupabaseConfigurationError(
      getAnalyticsSupabaseEnvStatus(),
    );
  }

  const { error } = await client.from("analytics_events").insert(record);

  if (error) {
    throw error;
  }
}
