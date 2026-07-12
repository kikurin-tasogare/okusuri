function requireValue(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export function getLineEnv() {
  return {
    lineChannelAccessToken: requireValue("LINE_CHANNEL_ACCESS_TOKEN"),
    lineChannelSecret: requireValue("LINE_CHANNEL_SECRET")
  };
}

export function getSupabaseEnv() {
  return {
    supabaseUrl: requireValue("SUPABASE_URL"),
    supabaseServiceRoleKey: requireValue("SUPABASE_SERVICE_ROLE_KEY")
  };
}

export function getAppEnv() {
  return {
    appBaseUrl: process.env.APP_BASE_URL ?? "",
    cronSecret: process.env.CRON_SECRET ?? "",
    adminUsername: process.env.ADMIN_USERNAME ?? "",
    adminPassword: process.env.ADMIN_PASSWORD ?? "",
    encryptionSecret: process.env.ENCRYPTION_SECRET ?? ""
  };
}

export function getEnvStatus() {
  return {
    lineChannelAccessToken: Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN),
    lineChannelSecret: Boolean(process.env.LINE_CHANNEL_SECRET),
    supabaseUrl: Boolean(process.env.SUPABASE_URL),
    supabaseServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    appBaseUrl: Boolean(process.env.APP_BASE_URL),
    cronSecret: Boolean(process.env.CRON_SECRET),
    adminUsername: Boolean(process.env.ADMIN_USERNAME),
    adminPassword: Boolean(process.env.ADMIN_PASSWORD),
    encryptionSecret: Boolean(process.env.ENCRYPTION_SECRET)
  };
}
