import { cleanText, isEmail, isUuid } from '~/lib/http';

const labels: Record<string, string> = {
  category: 'カテゴリ',
  categories: '希望カテゴリ',
  machineName: '機種名・メーカー',
  modelDetail: '希望機種',
  manufacturedYear: '製造年',
  manufacturedMonth: '製造月',
  usageNotes: '使用状況',
  maintenance: '保守状況',
  desiredPrice: '希望売却額',
  budgetRange: '希望予算',
  timing: '希望時期',
  notes: '補足',
  clinicName: 'クリニック・組織名',
};
const values: Record<string, string> = {
  'under-3': '300万円以下',
  '3-5': '300〜500万円',
  '5-8': '500〜800万円',
  '8-12': '800〜1200万円',
  'over-12': '1200万円以上',
  undecided: '未定',
  soon: 'すぐに',
  '1month': '1か月以内',
  '3months': '3か月以内',
  '6months': '半年以内',
  researching: '情報収集中',
  maker: 'メーカー保守',
  'third-party': '第三者保守',
  none: '未加入',
  unknown: '不明',
};

export function parseIntake(data: Record<string, unknown>, legacy: boolean, memberEmail: string | null) {
  const topic = legacy ? data.formType : data.topic;
  if (!['sell', 'buy', 'other'].includes(String(topic))) return { error: '相談種別を選択してください' };
  const name = cleanText(legacy ? data.name : data.contact_name);
  const email = cleanText(legacy ? data.email : data.contact_email) || memberEmail || '';
  const phone = cleanText(legacy ? data.phone : data.contact_phone);
  if (!email && !phone) return { error: '返信先のメールアドレスか電話番号を入力してください' };
  if (email && !isEmail(email)) return { error: 'メールアドレスの形式を確認してください' };
  if (phone && !/^[+\d\s()ー−-]{7,30}$/.test(phone)) return { error: '電話番号の形式を確認してください' };
  if (name.length > 100) return { error: 'お名前は100文字以内で入力してください' };
  if (legacy && !name) return { error: 'お名前を入力してください' };
  if (legacy && topic === 'sell' && (!cleanText(data.category) || !cleanText(data.machineName))) {
    return { error: 'カテゴリと機種名を入力してください' };
  }
  if (legacy && topic === 'buy' && !cleanText(data.budgetRange)) return { error: '希望予算を選択してください' };
  const structured: Record<string, string | string[]> = {};
  if (legacy) {
    for (const key of Object.keys(labels)) {
      const value = data[key];
      if (Array.isArray(value)) {
        if (value.length > 20 || value.some((v) => typeof v !== 'string' || v.length > 100))
          return { error: '選択項目が不正です' };
        structured[key] = value;
      } else if (value != null) {
        if (typeof value !== 'string' || value.length > 4000) return { error: '入力内容が長すぎるか形式が不正です' };
        structured[key] = value.trim();
      }
    }
  }
  const body = legacy
    ? Object.entries(structured)
        .filter(([, v]) => v.length)
        .map(([k, v]) => `${labels[k]}：${Array.isArray(v) ? v.join('、') : (values[v] ?? v)}`)
        .join('\n')
    : cleanText(data.body);
  if (!body || body.length > 10_000) return { error: '相談内容を1〜10000文字で入力してください' };
  for (const key of ['related_listing_id', 'related_wanted_id']) {
    if (data[key] && !isUuid(data[key])) return { error: '関連する案件の指定が不正です' };
  }
  return {
    value: {
      topic: String(topic),
      contact_name: name || null,
      contact_email: email || null,
      contact_phone: phone || null,
      body,
      source: legacy ? `contact_${topic}` : 'consultation',
      form_payload: structured,
      related_listing_id: data.related_listing_id || null,
      related_wanted_id: data.related_wanted_id || null,
    },
  };
}
