export type ContractParams = {
  maker: string;
  model: string;
  agreedPrice: number;
  makerMaintenance?: string | null;
  maintenanceTransferable?: string | null;
  hasAccessories?: boolean | null;
  accessoriesDetail?: string | null;
  sellerPrefecture?: string;
  sellerCity?: string;
  buyerPrefecture?: string;
  buyerCity?: string;
};

const MAINTENANCE_CLAUSE: Record<string, string> = {
  yes: 'メーカー保守契約が有効であり、引渡し時点での残存期間および引継ぎ条件は別紙記載のとおりとする。',
  no: 'メーカー保守契約は存在しない。保守は買い手の責任において手配するものとする。',
  unknown: 'メーカー保守契約の有無・引継ぎ可否は別途確認のうえ、別紙に記載する。',
};

const TRANSFER_CLAUSE: Record<string, string> = {
  yes: '保守契約の引継ぎは可能とする（メーカー承認等の条件を満たす場合）。',
  no: '保守契約の引継ぎは行わない。',
  unknown: '保守契約の引継ぎ可否は別途協議する。',
};

export function renderContractPreview(templateKey: string, params: ContractParams): string {
  const maintenance = params.makerMaintenance ?? 'unknown';
  const transfer = params.maintenanceTransferable ?? 'unknown';

  const accessories =
    params.hasAccessories && params.accessoriesDetail
      ? `付属品：${params.accessoriesDetail}`
      : params.hasAccessories
        ? '付属品あり（詳細は別紙）'
        : '付属品なし';

  return `【中古医療機器売買契約書（ひな形）】
テンプレート: ${templateKey}

第1条（目的）
売主と買主は、以下の機器について売買を行う。

  機器: ${params.maker} ${params.model}
  売買代金: ${params.agreedPrice.toLocaleString('ja-JP')}円（税別）

第2条（引渡し）
引渡し場所・時期は双方協議のうえ決定する。
売主所在地（公開情報）: ${params.sellerPrefecture ?? ''}${params.sellerCity ?? ''}
買主希望エリア: ${params.buyerPrefecture ?? ''}${params.buyerCity ?? ''}

第3条（保守）
${MAINTENANCE_CLAUSE[maintenance] ?? MAINTENANCE_CLAUSE.unknown}
${TRANSFER_CLAUSE[transfer] ?? TRANSFER_CLAUSE.unknown}

第4条（付属品）
${accessories}

第5条（特記事項）
製造販売業者への中古医療機器移転の通知は、売主の責任において行う。
薬機法その他関連法令を遵守すること。

---
※ 本書面は運営提供のひな形です。締結前に専門家への確認を推奨します。`;
}
