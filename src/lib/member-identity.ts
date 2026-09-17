/** Shared by the registration form and API. Format validation is not identity verification. */
export function normalizeCorporateNumber(value: string): string {
  return value.normalize('NFKC').replace(/[\s-]/g, '');
}

export function normalizeInvoiceNumber(value: string): string {
  return normalizeCorporateNumber(value).toUpperCase();
}

export function validateMemberIdentity(body: Record<string, unknown>): string | null {
  const type = body.account_type;
  const corporate = normalizeCorporateNumber(String(body.corporate_number ?? ''));
  const invoice = normalizeInvoiceNumber(String(body.invoice_registration_number ?? ''));
  if (type !== 'corporate' && type !== 'individual') return '法人または個人を選択してください';
  if (type === 'corporate') {
    if (!corporate) return '法人番号を入力してください';
    if (!/^[0-9]{13}$/.test(corporate)) return '法人番号は13桁の数字で入力してください';
    if (invoice) return '法人の場合は法人番号のみを入力してください';
  } else {
    if (!invoice) return 'インボイス登録番号を入力してください';
    if (!/^T[0-9]{13}$/.test(invoice)) return 'インボイス登録番号はT＋13桁の数字で入力してください';
    if (corporate) return '個人の場合はインボイス登録番号のみを入力してください';
  }
  return null;
}
