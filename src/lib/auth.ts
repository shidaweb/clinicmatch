import type { AstroCookies } from 'astro';
import { createSupabaseServerClient } from '~/lib/supabase/server';

type RuntimeLocals = {
  runtime?: {
    env?: Record<string, string | undefined>;
  };
};

export async function getSession(cookies: AstroCookies, locals?: RuntimeLocals) {
  const supabase = createSupabaseServerClient(cookies, locals);
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

export async function getProfile(cookies: AstroCookies, locals?: RuntimeLocals) {
  const session = await getSession(cookies, locals);
  if (!session) return null;

  const supabase = createSupabaseServerClient(cookies, locals);
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, org_id, full_name, role, organizations(id, prefecture, city, corporate_number, name, phone, contact_email)')
    .eq('id', session.user.id)
    .single();

  return profile;
}

/** Normalize: strip spaces and hyphens */
export function normalizeCorporateNumber(value: string): string {
  return value.replace(/[\s-]/g, '');
}

/** 13 digits + modulus-9 check digit (国税庁法人番号) */
export function isValidCorporateNumberCheckDigit(value: string): boolean {
  let total = 0;
  for (let i = 0; i < 13; i++) {
    let n = Number(value[i]) * (i % 2 === 1 ? 2 : 1);
    total += Math.floor(n / 10) + (n % 10);
  }
  return total % 9 === 0;
}

export function isValidCorporateNumber(value: string): boolean {
  const normalized = normalizeCorporateNumber(value);
  if (!/^\d{13}$/.test(normalized)) return false;
  return isValidCorporateNumberCheckDigit(normalized);
}

export function requireAuthRedirect(loginPath = '/auth/login') {
  return {
    redirect: loginPath,
  };
}

export async function requireAdmin(cookies: AstroCookies, locals?: RuntimeLocals) {
  const profile = await getProfile(cookies, locals);
  if (!profile) return { profile: null, error: 'unauthorized' as const };
  if (profile.role !== 'admin') return { profile, error: 'forbidden' as const };
  return { profile, error: null };
}

export type ProfileRow = NonNullable<Awaited<ReturnType<typeof getProfile>>>;
