type EnvRecord = Record<string, string | undefined>;

type RuntimeLocals = {
  runtime?: {
    env?: EnvRecord;
  };
};

export function getEnv(key: string, locals?: RuntimeLocals): string {
  const fromRuntime = locals?.runtime?.env?.[key];
  if (fromRuntime) return fromRuntime.trim();

  const fromMeta = import.meta.env[key];
  if (typeof fromMeta === 'string' && fromMeta) return fromMeta.trim();

  return '';
}

export function requireEnv(key: string, locals?: RuntimeLocals): string {
  const value = getEnv(key, locals);
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}

export function hasSupabaseConfig(locals?: RuntimeLocals): boolean {
  return Boolean(getEnv('PUBLIC_SUPABASE_URL', locals) && getEnv('PUBLIC_SUPABASE_ANON_KEY', locals));
}
