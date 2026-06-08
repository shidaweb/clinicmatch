import { escapeHtml, renderEmail } from './layout';

type EmailContent = { subject: string; html: string };

const DEFAULT_NOTE = 'お心当たりがない場合は、このメールを破棄してください。';

function p(text: string): string {
  return escapeHtml(text);
}

// --- 関心・提案 ---

export function interestToBuyer(siteUrl: string, params: { listingTitle: string }): EmailContent {
  return {
    subject: '【クリニックマッチ】関心を受け付けました',
    html: renderEmail({
      heading: '関心を受け付けました',
      paragraphs: [
        `「${p(params.listingTitle)}」への関心を受け付けました。`,
        '運営よりご連絡しますので、今しばらくお待ちください。',
      ],
      button: { label: 'マイページを開く', url: `${siteUrl}/account/approaches` },
      note: DEFAULT_NOTE,
    }),
  };
}

export function interestToSeller(
  siteUrl: string,
  params: { listingTitle: string; category: string; area: string }
): EmailContent {
  return {
    subject: '【クリニックマッチ】あなたの出品に関心が寄せられました',
    html: renderEmail({
      heading: 'あなたの出品に関心が寄せられました',
      paragraphs: [
        `「${p(params.listingTitle)}」（${p(params.category)}）に関心が寄せられました。`,
        '詳細は運営よりご連絡しますので、今しばらくお待ちください。',
        '相手の情報は、双方の合意後にのみ開示されます。',
      ],
      button: { label: 'マイページを開く', url: `${siteUrl}/account/approaches` },
      note: DEFAULT_NOTE,
    }),
  };
}

export function interestToAdmin(params: {
  approachId: string;
  listingId: string;
  fromOrgId: string;
  listingTitle: string;
  category: string;
  area: string;
  message?: string;
  adminUrl: string;
}): EmailContent {
  const lines = [
    `種別: 関心`,
    `アプローチID: ${params.approachId}`,
    `出品ID: ${params.listingId}`,
    `対象: ${params.listingTitle}（${params.category}）`,
    `エリア: ${params.area}`,
    `申込組織ID: ${params.fromOrgId}`,
  ];
  if (params.message) lines.push(`メッセージ: ${params.message}`);

  return {
    subject: '【クリニックマッチ】新規アプローチ（関心）',
    html: renderEmail({
      heading: '新規アプローチ（関心）',
      paragraphs: lines.map((line) => p(line)),
      button: { label: '対応する', url: params.adminUrl },
    }),
  };
}

export function offerToSeller(siteUrl: string, params: { wantedTitle: string }): EmailContent {
  return {
    subject: '【クリニックマッチ】提案を受け付けました',
    html: renderEmail({
      heading: '提案を受け付けました',
      paragraphs: [
        `「${p(params.wantedTitle)}」への提案を受け付けました。`,
        '運営よりご連絡しますので、今しばらくお待ちください。',
      ],
      button: { label: 'マイページを開く', url: `${siteUrl}/account/approaches` },
      note: DEFAULT_NOTE,
    }),
  };
}

export function offerToBuyer(
  siteUrl: string,
  params: { wantedTitle: string; category: string; area: string }
): EmailContent {
  return {
    subject: '【クリニックマッチ】あなたの買いたいに提案がありました',
    html: renderEmail({
      heading: 'あなたの買いたいに提案がありました',
      paragraphs: [
        `「${p(params.wantedTitle)}」（${p(params.category)}）に提案がありました。`,
        '詳細は運営よりご連絡しますので、今しばらくお待ちください。',
        '相手の情報は、双方の合意後にのみ開示されます。',
      ],
      button: { label: 'マイページを開く', url: `${siteUrl}/account/approaches` },
      note: DEFAULT_NOTE,
    }),
  };
}

export function offerToAdmin(params: {
  approachId: string;
  wantedId: string;
  fromOrgId: string;
  wantedTitle: string;
  category: string;
  area: string;
  message?: string;
  adminUrl: string;
}): EmailContent {
  const lines = [
    `種別: 提案`,
    `アプローチID: ${params.approachId}`,
    `買いたいID: ${params.wantedId}`,
    `対象: ${params.wantedTitle}（${params.category}）`,
    `エリア: ${params.area}`,
    `申込組織ID: ${params.fromOrgId}`,
  ];
  if (params.message) lines.push(`メッセージ: ${params.message}`);

  return {
    subject: '【クリニックマッチ】新規アプローチ（提案）',
    html: renderEmail({
      heading: '新規アプローチ（提案）',
      paragraphs: lines.map((line) => p(line)),
      button: { label: '対応する', url: params.adminUrl },
    }),
  };
}

// --- 相談・旧フォーム ---

export function consultAck(siteUrl: string): EmailContent {
  return {
    subject: '【クリニックマッチ】ご相談を受け付けました',
    html: renderEmail({
      heading: 'ご相談を受け付けました',
      paragraphs: [
        'クリニックマッチへのご相談ありがとうございます。',
        '内容を確認のうえ、運営よりご連絡いたします。',
      ],
      button: { label: 'サイトを開く', url: siteUrl },
      note: DEFAULT_NOTE,
    }),
  };
}

export function consultToAdmin(params: {
  topic: string;
  body: string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  orgId?: string | null;
  adminUrl: string;
}): EmailContent {
  const lines = [
    `種別: ${params.topic}`,
    `内容: ${params.body}`,
  ];
  if (params.contactName) lines.push(`お名前: ${params.contactName}`);
  if (params.contactEmail) lines.push(`メール: ${params.contactEmail}`);
  if (params.contactPhone) lines.push(`電話: ${params.contactPhone}`);
  if (params.orgId) lines.push(`組織ID: ${params.orgId}`);

  return {
    subject: '【クリニックマッチ】新規相談',
    html: renderEmail({
      heading: '新規相談',
      paragraphs: lines.map((line) => p(line)),
      button: { label: '対応する', url: params.adminUrl },
    }),
  };
}

export function contactToAdmin(params: {
  formType: string;
  fields: Array<{ label: string; value: string }>;
}): EmailContent {
  return {
    subject: `【クリニックマッチ】${params.formType}のお問い合わせ`,
    html: renderEmail({
      heading: `${params.formType}のお問い合わせ`,
      paragraphs: params.fields.map((f) => p(`${f.label}: ${f.value}`)),
    }),
  };
}

// --- Q&A ---

export function qaThreadToBuyer(siteUrl: string, params: { listingTitle: string }): EmailContent {
  return {
    subject: '【クリニックマッチ】質問を受け付けました',
    html: renderEmail({
      heading: '質問を受け付けました',
      paragraphs: [
        `「${p(params.listingTitle)}」への質問を受け付けました。`,
        '運営よりご連絡しますので、今しばらくお待ちください。',
      ],
      button: { label: 'マイページを開く', url: `${siteUrl}/account/threads` },
      note: DEFAULT_NOTE,
    }),
  };
}

export function qaThreadToSeller(siteUrl: string, params: { listingTitle: string; category: string }): EmailContent {
  return {
    subject: '【クリニックマッチ】出品への質問が届きました',
    html: renderEmail({
      heading: '出品への質問が届きました',
      paragraphs: [
        `「${p(params.listingTitle)}」（${p(params.category)}）に質問が届きました。`,
        '詳細は運営よりご連絡しますので、今しばらくお待ちください。',
      ],
      button: { label: 'マイページを開く', url: `${siteUrl}/account/threads` },
      note: DEFAULT_NOTE,
    }),
  };
}

export function qaThreadToAdmin(params: {
  threadId: string;
  listingId: string;
  listingTitle: string;
  message: string;
  adminUrl: string;
}): EmailContent {
  return {
    subject: '【クリニックマッチ】保守Q&Aが開始されました',
    html: renderEmail({
      heading: '保守Q&Aが開始されました',
      paragraphs: [
        p(`スレッドID: ${params.threadId}`),
        p(`出品ID: ${params.listingId}`),
        p(`対象: ${params.listingTitle}`),
        p(`メッセージ: ${params.message}`),
      ],
      button: { label: '対応する', url: params.adminUrl },
    }),
  };
}

// --- 新着メッセージ ---

export function newMessageToUser(siteUrl: string, params: { threadId: string }): EmailContent {
  return {
    subject: '【クリニックマッチ】新着メッセージがあります',
    html: renderEmail({
      heading: '新着メッセージがあります',
      paragraphs: [
        'やり取り中のスレッドに新しいメッセージが届きました。',
        '内容はマイページからご確認ください。',
      ],
      button: { label: 'スレッドを開く', url: `${siteUrl}/account/threads/${params.threadId}` },
      note: DEFAULT_NOTE,
    }),
  };
}

export function newMessageToAdmin(params: {
  threadId: string;
  senderType: string;
  preview: string;
  adminUrl: string;
}): EmailContent {
  return {
    subject: '【クリニックマッチ】新着メッセージ',
    html: renderEmail({
      heading: '新着メッセージ',
      paragraphs: [
        p(`スレッドID: ${params.threadId}`),
        p(`送信者: ${params.senderType}`),
        p(`内容: ${params.preview}`),
      ],
      button: { label: '対応する', url: params.adminUrl },
    }),
  };
}

// --- 仲介開始 ---

export function mediationStartToParty(siteUrl: string, params: { threadId: string }): EmailContent {
  return {
    subject: '【クリニックマッチ】運営が仲介を開始しました',
    html: renderEmail({
      heading: '運営が仲介を開始しました',
      paragraphs: [
        'クリニックマッチの運営が仲介を開始しました。',
        '匿名のままやり取りを続けていただけます。詳細はマイページをご確認ください。',
      ],
      button: { label: 'スレッドを開く', url: `${siteUrl}/account/threads/${params.threadId}` },
      note: DEFAULT_NOTE,
    }),
  };
}

export function mediationStartToAdmin(params: {
  approachId: string;
  threadId: string;
  adminUrl: string;
}): EmailContent {
  return {
    subject: '【クリニックマッチ】仲介スレッド開始',
    html: renderEmail({
      heading: '仲介スレッド開始',
      paragraphs: [
        p(`アプローチID: ${params.approachId}`),
        p(`スレッドID: ${params.threadId}`),
      ],
      button: { label: 'スレッドを開く', url: params.adminUrl },
    }),
  };
}

// --- 合意・連絡先開示 ---

export function discloseToParty(siteUrl: string, params: { threadId: string }): EmailContent {
  return {
    subject: '【クリニックマッチ】合意成立・連絡先を開示しました',
    html: renderEmail({
      heading: '合意成立・連絡先を開示しました',
      paragraphs: [
        '双方の合意が確認され、連絡先が開示されました。',
        'マイページの保護画面からご確認ください。',
      ],
      button: { label: '連絡先を確認する', url: `${siteUrl}/account/threads/${params.threadId}` },
      note: DEFAULT_NOTE,
    }),
  };
}

export function discloseToAdmin(params: { threadId: string; adminUrl: string }): EmailContent {
  return {
    subject: '【クリニックマッチ】合意成立・連絡先開示',
    html: renderEmail({
      heading: '合意成立・連絡先開示',
      paragraphs: [p(`スレッドID: ${params.threadId}`)],
      button: { label: 'スレッドを開く', url: params.adminUrl },
    }),
  };
}

// --- 成約・手数料 ---

export function concludeToSeller(
  siteUrl: string,
  params: { dealId: string; agreedPrice: number; commissionAmount: number }
): EmailContent {
  return {
    subject: '【クリニックマッチ】売買契約成立・手数料のご案内',
    html: renderEmail({
      heading: '売買契約成立・手数料のご案内',
      paragraphs: [
        '売買契約が成立しました。おめでとうございます。',
        `成約額: ${params.agreedPrice.toLocaleString()}円`,
        `仲介手数料（7.5%）: ${params.commissionAmount.toLocaleString()}円`,
        '手数料のご請求について、運営より別途ご連絡いたします。',
      ],
      button: { label: 'マイページを開く', url: `${siteUrl}/account` },
      note: DEFAULT_NOTE,
    }),
  };
}

export function concludeToBuyer(siteUrl: string): EmailContent {
  return {
    subject: '【クリニックマッチ】取引が成立しました',
    html: renderEmail({
      heading: '取引が成立しました',
      paragraphs: [
        '売買契約が成立しました。おめでとうございます。',
        '今後の手続きについて、運営よりご連絡いたします。',
      ],
      button: { label: 'マイページを開く', url: `${siteUrl}/account` },
      note: DEFAULT_NOTE,
    }),
  };
}

export function concludeToAdmin(params: {
  dealId: string;
  agreedPrice: number;
  commissionAmount: number;
  adminUrl: string;
}): EmailContent {
  return {
    subject: '【クリニックマッチ】売買成約・手数料請求発行',
    html: renderEmail({
      heading: '売買成約・手数料請求発行',
      paragraphs: [
        p(`Deal ID: ${params.dealId}`),
        p(`成約額: ${params.agreedPrice.toLocaleString()}円`),
        p(`手数料(7.5%): ${params.commissionAmount.toLocaleString()}円`),
      ],
      button: { label: '対応する', url: params.adminUrl },
    }),
  };
}

// --- 出品・買いたい 審査 ---

export function submissionToActor(siteUrl: string, params: { type: 'listing' | 'wanted'; title: string }): EmailContent {
  const label = params.type === 'listing' ? '売りたい' : '買いたい';
  return {
    subject: `【クリニックマッチ】${label}の登録を受け付けました`,
    html: renderEmail({
      heading: `${label}の登録を受け付けました`,
      paragraphs: [
        `「${p(params.title)}」の${label}登録を受け付けました。`,
        '審査完了後に公開いたします。しばらくお待ちください。',
      ],
      button: { label: 'マイページを開く', url: `${siteUrl}/account` },
      note: DEFAULT_NOTE,
    }),
  };
}

export function submissionToAdmin(params: {
  type: 'listing' | 'wanted';
  id: string;
  title: string;
  orgId: string;
  adminUrl: string;
}): EmailContent {
  const label = params.type === 'listing' ? '売りたい' : '買いたい';
  return {
    subject: `【クリニックマッチ】新規${label}（審査待ち）`,
    html: renderEmail({
      heading: `新規${label}（審査待ち）`,
      paragraphs: [
        p(`種別: ${label}`),
        p(`ID: ${params.id}`),
        p(`タイトル: ${params.title}`),
        p(`組織ID: ${params.orgId}`),
      ],
      button: { label: '審査する', url: params.adminUrl },
    }),
  };
}

export function postPublishedToApplicant(
  siteUrl: string,
  params: { type: 'listing' | 'wanted'; title: string; id: string }
): EmailContent {
  const label = params.type === 'listing' ? '売りたい' : '買いたい';
  const path = params.type === 'listing' ? `/cases/listing/${params.id}` : `/cases/wanted/${params.id}`;
  return {
    subject: `【クリニックマッチ】${label}が公開されました`,
    html: renderEmail({
      heading: `${label}が公開されました`,
      paragraphs: [
        `「${p(params.title)}」の${label}が公開されました。`,
        'サイト上でご確認いただけます。',
      ],
      button: { label: '公開ページを見る', url: `${siteUrl}${path}` },
      note: DEFAULT_NOTE,
    }),
  };
}
