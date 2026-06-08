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
  return value.replace(/[\s\u3000-]/g, '');
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

/** 会員登録用：13桁数字のみ（ハイフン・空白は除去後に判定。API実在確認は行わない） */
export function isValidCorporateNumberFormat(value: string): boolean {
  return /^\d{13}$/.test(normalizeCorporateNumber(value));
}

export const PASSWORD_RULES_MESSAGE =
  'パスワードは8文字以上64文字以内で、英大文字・英小文字・数字をそれぞれ1文字以上含めてください';

export type AuthErrorLike = { message?: string; code?: string };

export function mapAuthLoginError(error: AuthErrorLike): { message: string; code?: string } {
  const msg = (error.message ?? '').toLowerCase();
  const code = error.code ?? '';

  if (
    code === 'email_not_confirmed' ||
    msg.includes('email not confirmed') ||
    msg.includes('not confirmed')
  ) {
    return {
      message:
        'メールアドレスの確認が完了していません。登録時の確認メールのリンクをクリックしてください。',
      code: 'email_not_confirmed',
    };
  }
  if (
    code === 'invalid_credentials' ||
    msg.includes('invalid login credentials') ||
    msg.includes('invalid credentials')
  ) {
    return {
      message: 'メールアドレスまたはパスワードが正しくありません。入力内容をご確認ください。',
      code: 'invalid_credentials',
    };
  }
  if (code === 'user_banned' || msg.includes('user is banned') || msg.includes('banned')) {
    return {
      message: 'このアカウントは利用停止中です。運営にお問い合わせください。',
      code: 'user_banned',
    };
  }
  if (
    code === 'over_request_rate_limit' ||
    code === 'too_many_requests' ||
    msg.includes('too many') ||
    msg.includes('rate limit')
  ) {
    return {
      message:
        'ログイン試行回数が上限に達しました。しばらく時間をおいてから再度お試しください。',
      code: 'rate_limit',
    };
  }
  if (msg.includes('email') && (msg.includes('invalid') || msg.includes('format'))) {
    return { message: 'メールアドレスの形式が正しくありません。', code: 'invalid_email' };
  }

  return {
    message:
      'ログインに失敗しました。メールアドレスとパスワードをご確認のうえ、再度お試しください。',
    code: code || undefined,
  };
}

export function mapAuthRegisterError(error: AuthErrorLike): string {
  const msg = (error.message ?? '').toLowerCase();
  const code = error.code ?? '';

  if (
    code === 'user_already_exists' ||
    msg.includes('already registered') ||
    msg.includes('already exists')
  ) {
    return 'このメールアドレスは既に登録されています。ログインするか、別のメールアドレスをお試しください。';
  }
  if (msg.includes('password') && (msg.includes('weak') || msg.includes('short'))) {
    return PASSWORD_RULES_MESSAGE;
  }
  if (msg.includes('email') && (msg.includes('invalid') || msg.includes('format'))) {
    return 'メールアドレスの形式が正しくありません。';
  }
  if (code === 'over_request_rate_limit' || msg.includes('rate limit')) {
    return '登録試行回数が上限に達しました。しばらく時間をおいてから再度お試しください。';
  }

  return '登録に失敗しました。入力内容をご確認のうえ、再度お試しください。';
}

export function validateRegisterPayload(body: Record<string, unknown>): string | null {
  const email = String(body.email ?? '').trim();
  const password = String(body.password ?? '');
  const corporateNumber = normalizeCorporateNumber(String(body.corporate_number ?? ''));
  const name = String(body.name ?? '').trim();
  const fullName = String(body.full_name ?? '').trim();
  const prefecture = String(body.prefecture ?? '').trim();
  const city = String(body.city ?? '').trim();

  if (!email) return 'メールアドレスを入力してください';
  if (!password) return 'パスワードを入力してください';
  if (!isValidPassword(password)) return PASSWORD_RULES_MESSAGE;
  if (!corporateNumber) return '法人番号を入力してください';
  if (!isValidCorporateNumberFormat(corporateNumber)) {
    return '法人番号は13桁の数字で入力してください';
  }
  if (!name) return '組織名を入力してください';
  if (!fullName) return '担当者名を入力してください';
  if (!prefecture) return '都道府県を選択してください';
  if (!city) return '市区町村を入力してください';

  return null;
}

export function isValidPassword(password: string): boolean {
  if (password.length < 8 || password.length > 64) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/\d/.test(password)) return false;
  return true;
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
