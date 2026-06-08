import { SITE } from 'astrowind:config';

/** メール確認後のリダイレクト先オリジン（本番は canonical） */
export function getAuthRedirectOrigin(request: Request): string {
  const { hostname, origin } = new URL(request.url);
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return origin;
  }
  const configured = SITE?.site?.replace(/\/$/, '');
  return configured || origin;
}

export function getEmailConfirmRedirectUrl(request: Request): string {
  return `${getAuthRedirectOrigin(request)}/auth/confirm`;
}
