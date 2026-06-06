export const MEDIATION_STATUS_LABELS: Record<string, string> = {
  draft: '下書き',
  sent: '送付済',
  signed: '成立',
  cancelled: '取消',
};

export const DEAL_STATUS_LABELS: Record<string, string> = {
  negotiating: '交渉中',
  contracted: '成約',
  delivered: '引渡済',
  completed: '完了',
  cancelled: '取消',
};

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  issued: '請求済',
  paid: '入金済',
  void: '無効',
};

export const COMMISSION_RATE = 0.075;

export function calcCommission(amount: number, rate = COMMISSION_RATE): number {
  return Math.round(amount * rate);
}

export const CONTRACT_TEMPLATES = [
  { key: 'with_maintenance', label: 'メーカー保守あり・引継ぎ可' },
  { key: 'no_maintenance', label: 'メーカー保守なし' },
  { key: 'maintenance_unknown', label: '保守状況不明' },
] as const;
