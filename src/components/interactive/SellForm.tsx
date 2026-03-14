import { useState } from 'react';

const PRIMARY_GREEN = '#2ECC71';
const LINE_URL = 'https://lin.ee/vepVhWc';

const CATEGORY_OPTIONS = [
  { value: '', label: '選択してください' },
  { value: 'hair-removal', label: '脱毛' },
  { value: 'pico', label: 'ピコ' },
  { value: 'ipl', label: 'IPL' },
  { value: 'hifu', label: 'HIFU' },
  { value: 'rf', label: 'RF' },
  { value: 'body', label: '痩身' },
  { value: 'others', label: 'その他' },
];

const MAINTENANCE_OPTIONS = [
  { value: 'maker', label: 'メーカー保守加入中' },
  { value: 'third-party', label: '第三者保守' },
  { value: 'none', label: '未加入' },
  { value: 'unknown', label: '不明' },
];

const YEARS = Array.from({ length: 20 }, (_, i) => new Date().getFullYear() - 10 + i);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export interface SellFormData {
  category: string;
  machineName: string;
  manufacturedYear: string;
  manufacturedMonth: string;
  usageNotes: string;
  maintenance: string;
  desiredPrice: string;
  notes: string;
  name: string;
  clinicName: string;
  email: string;
  phone: string;
}

const initialData: SellFormData = {
  category: '',
  machineName: '',
  manufacturedYear: '',
  manufacturedMonth: '',
  usageNotes: '',
  maintenance: '',
  desiredPrice: '',
  notes: '',
  name: '',
  clinicName: '',
  email: '',
  phone: '',
};

const inputBase =
  'w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-0 transition-colors';
const inputFocus = 'focus:border-[#2ECC71] focus:ring-[#2ECC71]/30';
const labelClass = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1';
const errorClass = 'text-red-600 dark:text-red-400 text-sm mt-1';

export default function SellForm() {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<SellFormData>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);

  const update = (key: keyof SellFormData, value: string) => {
    setData((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: '' }));
  };

  const validateStep1 = () => {
    const e: Record<string, string> = {};
    if (!data.category) e.category = 'カテゴリを選択してください';
    if (!data.machineName.trim()) e.machineName = '機器名・メーカー・型番を入力してください';
    if (!data.manufacturedYear) e.manufacturedYear = '製造年を選択してください';
    if (!data.manufacturedMonth) e.manufacturedMonth = '製造月を選択してください';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep3 = () => {
    const e: Record<string, string> = {};
    if (!data.name.trim()) e.name = 'お名前を入力してください';
    if (!data.email.trim()) e.email = 'メールアドレスを入力してください';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) e.email = '有効なメールアドレスを入力してください';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    setStep((s) => Math.min(3, s + 1));
  };

  const handleBack = () => setStep((s) => Math.max(1, s - 1));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep3()) return;
    setSending(true);
    setErrors({});

    const payload = {
      formType: 'sell' as const,
      ...data,
    };

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as { error?: string })?.error || '送信に失敗しました');
      }
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      setErrors({
        submit:
          err instanceof Error ? err.message : '送信に失敗しました。しばらくしてから再度お試しください。',
      });
    } finally {
      setSending(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-8 text-center">
        <p className="text-lg text-slate-800 dark:text-slate-200 mb-6">
          ご相談ありがとうございます。通常1営業日以内にご連絡します。
        </p>
        <a
          href={LINE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-full px-6 py-3 text-white font-semibold transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#06C755' }}
        >
          LINEで友だち追加
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <div
          className="h-2 flex-1 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden"
          role="progressbar"
          aria-valuenow={step}
          aria-valuemin={1}
          aria-valuemax={3}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${(step / 3) * 100}%`, backgroundColor: PRIMARY_GREEN }}
          />
        </div>
        <span className="text-sm font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
          Step {step}/3
        </span>
      </div>

      {/* Step 1: 機器の情報 */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <label htmlFor="sell-category" className={labelClass}>
              カテゴリ
            </label>
            <select
              id="sell-category"
              value={data.category}
              onChange={(e) => update('category', e.target.value)}
              className={`${inputBase} ${inputFocus}`}
              required
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value || 'empty'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {errors.category && <p className={errorClass}>{errors.category}</p>}
          </div>
          <div>
            <label htmlFor="sell-machineName" className={labelClass}>
              機器名・メーカー・型番 <span className="text-red-500">*</span>
            </label>
            <input
              id="sell-machineName"
              type="text"
              value={data.machineName}
              onChange={(e) => update('machineName', e.target.value)}
              className={`${inputBase} ${inputFocus}`}
              placeholder="例: ジェントルマックスプロ / シネロン・キャンデラ / GentleMax Pro"
              required
            />
            {errors.machineName && <p className={errorClass}>{errors.machineName}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="sell-year" className={labelClass}>
                製造年 <span className="text-red-500">*</span>
              </label>
              <select
                id="sell-year"
                value={data.manufacturedYear}
                onChange={(e) => update('manufacturedYear', e.target.value)}
                className={`${inputBase} ${inputFocus}`}
                required
              >
                <option value="">年</option>
                {YEARS.map((y) => (
                  <option key={y} value={String(y)}>
                    {y}年
                  </option>
                ))}
              </select>
              {errors.manufacturedYear && <p className={errorClass}>{errors.manufacturedYear}</p>}
            </div>
            <div>
              <label htmlFor="sell-month" className={labelClass}>
                製造月 <span className="text-red-500">*</span>
              </label>
              <select
                id="sell-month"
                value={data.manufacturedMonth}
                onChange={(e) => update('manufacturedMonth', e.target.value)}
                className={`${inputBase} ${inputFocus}`}
                required
              >
                <option value="">月</option>
                {MONTHS.map((m) => (
                  <option key={m} value={String(m)}>
                    {m}月
                  </option>
                ))}
              </select>
              {errors.manufacturedMonth && <p className={errorClass}>{errors.manufacturedMonth}</p>}
            </div>
          </div>
          <div>
            <label htmlFor="sell-usageNotes" className={labelClass}>
              ショット数・使用状況（任意）
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">分かる範囲でOK</p>
            <input
              id="sell-usageNotes"
              type="text"
              value={data.usageNotes}
              onChange={(e) => update('usageNotes', e.target.value)}
              className={`${inputBase} ${inputFocus}`}
              placeholder="例: ALEX/YAG累計 約320万ショット"
            />
          </div>
        </div>
      )}

      {/* Step 2: 機器の状態 */}
      {step === 2 && (
        <div className="space-y-6">
          <div>
            <p className={labelClass}>保守契約の状態</p>
            <div className="space-y-2">
              {MAINTENANCE_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="maintenance"
                    value={opt.value}
                    checked={data.maintenance === opt.value}
                    onChange={(e) => update('maintenance', e.target.value)}
                    className="border-slate-300 text-[#2ECC71] focus:ring-[#2ECC71]"
                  />
                  <span className="text-slate-700 dark:text-slate-300">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="sell-desiredPrice" className={labelClass}>
              希望売却価格（任意）
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">目安でOK</p>
            <input
              id="sell-desiredPrice"
              type="text"
              value={data.desiredPrice}
              onChange={(e) => update('desiredPrice', e.target.value)}
              className={`${inputBase} ${inputFocus}`}
              placeholder="例: 600〜800万円帯"
            />
          </div>
          <div>
            <label htmlFor="sell-notes" className={labelClass}>
              備考（任意）
            </label>
            <textarea
              id="sell-notes"
              value={data.notes}
              onChange={(e) => update('notes', e.target.value)}
              rows={4}
              className={`${inputBase} ${inputFocus}`}
              placeholder="ご要望があればご記入ください"
            />
          </div>
        </div>
      )}

      {/* Step 3: ご連絡先 */}
      {step === 3 && (
        <div className="space-y-5">
          <div>
            <label htmlFor="sell-name" className={labelClass}>
              お名前 <span className="text-red-500">*</span>
            </label>
            <input
              id="sell-name"
              type="text"
              value={data.name}
              onChange={(e) => update('name', e.target.value)}
              className={`${inputBase} ${inputFocus}`}
              placeholder="山田 太郎"
              required
            />
            {errors.name && <p className={errorClass}>{errors.name}</p>}
          </div>
          <div>
            <label htmlFor="sell-clinic" className={labelClass}>
              クリニック名（任意）
            </label>
            <input
              id="sell-clinic"
              type="text"
              value={data.clinicName}
              onChange={(e) => update('clinicName', e.target.value)}
              className={`${inputBase} ${inputFocus}`}
              placeholder="〇〇クリニック"
            />
          </div>
          <div>
            <label htmlFor="sell-email" className={labelClass}>
              メールアドレス <span className="text-red-500">*</span>
            </label>
            <input
              id="sell-email"
              type="email"
              value={data.email}
              onChange={(e) => update('email', e.target.value)}
              className={`${inputBase} ${inputFocus}`}
              placeholder="example@clinic.jp"
              required
            />
            {errors.email && <p className={errorClass}>{errors.email}</p>}
          </div>
          <div>
            <label htmlFor="sell-phone" className={labelClass}>
              電話番号（任意）
            </label>
            <input
              id="sell-phone"
              type="tel"
              value={data.phone}
              onChange={(e) => update('phone', e.target.value)}
              className={`${inputBase} ${inputFocus}`}
              placeholder="03-1234-5678"
            />
          </div>
          {errors.submit && <p className={errorClass}>{errors.submit}</p>}
        </div>
      )}

      {/* Buttons */}
      <div className="flex flex-wrap gap-3 pt-4">
        {step > 1 && (
          <button
            type="button"
            onClick={handleBack}
            className="px-6 py-2.5 rounded-full border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            戻る
          </button>
        )}
        {step < 3 ? (
          <button
            type="button"
            onClick={handleNext}
            className="px-6 py-2.5 rounded-full text-white font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: PRIMARY_GREEN }}
          >
            次へ
          </button>
        ) : (
          <button
            type="submit"
            disabled={sending}
            className="px-6 py-2.5 rounded-full text-white font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: PRIMARY_GREEN }}
          >
            {sending ? '送信中...' : '送信する'}
          </button>
        )}
      </div>
    </form>
  );
}
