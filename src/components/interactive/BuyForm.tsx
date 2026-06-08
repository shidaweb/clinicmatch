import { useState } from 'react';
import FormStepProgress from '~/components/interactive/FormStepProgress';
import { trackGaEvent } from '~/utils/analytics';

const PRIMARY = '#C98B97';
const REQUIRED = '#B5524E';

const CATEGORY_OPTIONS = [
  { value: 'hair-removal', label: '脱毛' },
  { value: 'pico', label: 'ピコ' },
  { value: 'ipl', label: 'IPL' },
  { value: 'hifu', label: 'HIFU' },
  { value: 'rf', label: 'RF' },
  { value: 'body', label: '痩身' },
  { value: 'others', label: 'その他' },
];

const BUDGET_OPTIONS = [
  { value: 'under-3', label: '〜300万' },
  { value: '3-5', label: '300〜500万' },
  { value: '5-8', label: '500〜800万' },
  { value: '8-12', label: '800〜1200万' },
  { value: 'over-12', label: '1200万〜' },
  { value: 'undecided', label: '未定' },
];

const TIMING_OPTIONS = [
  { value: 'soon', label: 'すぐに' },
  { value: '1month', label: '1ヶ月以内' },
  { value: '3months', label: '3ヶ月以内' },
  { value: '6months', label: '半年以内' },
  { value: 'researching', label: '情報収集中' },
];

export interface BuyFormData {
  categories: string[];
  modelDetail: string;
  budgetRange: string;
  timing: string;
  notes: string;
  name: string;
  clinicName: string;
  email: string;
  phone: string;
}

const initialData: BuyFormData = {
  categories: [],
  modelDetail: '',
  budgetRange: '',
  timing: '',
  notes: '',
  name: '',
  clinicName: '',
  email: '',
  phone: '',
};

const inputBase =
  'w-full h-11 rounded-[10px] border border-[#EADCD4] bg-white px-4 py-2.5 text-[#46343A] placeholder:text-[#9B848A] focus:outline-none focus:ring-2 focus:ring-offset-0 transition-colors';
const inputFocus = 'focus:border-[#C98B97] focus:ring-[#C98B97]/30';
const labelClass = 'block text-sm font-medium text-[#7A5C63] mb-1';
const errorClass = 'text-sm mt-1';
const errorStyle = { color: REQUIRED };
const pillBase =
  'rounded-full px-4 py-2 text-sm font-medium border transition-colors';
const pillActive = 'bg-[#A86A77] text-white border-[#A86A77]';
const pillIdle = 'bg-white text-[#46343A] border-[#EADCD4] hover:border-[#C98B97]';

export default function BuyForm() {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<BuyFormData>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  const update = (key: keyof BuyFormData, value: string | string[]) => {
    setData((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: '' }));
  };

  const toggleCategory = (value: string) => {
    setData((prev) => ({
      ...prev,
      categories: prev.categories.includes(value)
        ? prev.categories.filter((c) => c !== value)
        : [...prev.categories, value],
    }));
  };

  const validateStep1 = () => {
    const e: Record<string, string> = {};
    if (data.budgetRange === '') e.budgetRange = '希望予算を選択してください';
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
      formType: 'buy' as const,
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
      trackGaEvent('buy_form_submit', {
        form_type: 'buy',
        categories_count: data.categories.length,
      });
      window.location.assign('/contact/buy/thanks');
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

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <FormStepProgress step={step} />

      {/* Step 1: 機器について */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <p className={labelClass}>検討中のカテゴリ（複数選択可）</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {CATEGORY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleCategory(opt.value)}
                  className={`${pillBase} ${data.categories.includes(opt.value) ? pillActive : pillIdle}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="buy-modelDetail" className={labelClass}>
              具体的な機種名（任意）
            </label>
            <input
              id="buy-modelDetail"
              type="text"
              value={data.modelDetail}
              onChange={(e) => update('modelDetail', e.target.value)}
              className={`${inputBase} ${inputFocus}`}
              placeholder="例: ジェントルマックスプロ"
            />
          </div>
          <div>
            <p className={labelClass}>
              希望予算レンジ <span style={{ color: REQUIRED }}>*</span>
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {BUDGET_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => update('budgetRange', opt.value)}
                  className={`${pillBase} ${data.budgetRange === opt.value ? pillActive : pillIdle}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {errors.budgetRange && <p className={errorClass} style={errorStyle}>{errors.budgetRange}</p>}
          </div>
        </div>
      )}

      {/* Step 2: 導入について */}
      {step === 2 && (
        <div className="space-y-6">
          <div>
            <p className={labelClass}>導入予定時期</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {TIMING_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => update('timing', opt.value)}
                  className={`${pillBase} ${data.timing === opt.value ? pillActive : pillIdle}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="buy-notes" className={labelClass}>
              備考・ご要望（任意）
            </label>
            <textarea
              id="buy-notes"
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
            <label htmlFor="buy-name" className={labelClass}>
              お名前 <span style={{ color: REQUIRED }}>*</span>
            </label>
            <input
              id="buy-name"
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
            <label htmlFor="buy-clinic" className={labelClass}>
              クリニック名（任意）
            </label>
            <p className="text-xs text-[#9B848A] mb-1">匿名でもOKです</p>
            <input
              id="buy-clinic"
              type="text"
              value={data.clinicName}
              onChange={(e) => update('clinicName', e.target.value)}
              className={`${inputBase} ${inputFocus}`}
              placeholder="〇〇クリニック"
            />
          </div>
          <div>
            <label htmlFor="buy-email" className={labelClass}>
              メールアドレス <span style={{ color: REQUIRED }}>*</span>
            </label>
            <input
              id="buy-email"
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
            <label htmlFor="buy-phone" className={labelClass}>
              電話番号（任意）
            </label>
            <input
              id="buy-phone"
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
      <div className="flex flex-wrap gap-3 pt-4 sticky bottom-0 bg-ivory pb-2 -mx-1 px-1">
        {step > 1 && (
          <button
            type="button"
            onClick={handleBack}
            className="px-6 py-2.5 rounded-full border border-[#EADCD4] text-[#46343A] hover:bg-[#FBF5F1] transition-colors"
          >
            戻る
          </button>
        )}
        {step < 3 ? (
          <button
            type="button"
            onClick={handleNext}
            className="flex-1 min-w-[140px] px-6 py-2.5 rounded-full text-white font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: PRIMARY }}
          >
            次へ
          </button>
        ) : (
          <button
            type="submit"
            disabled={sending}
            className="flex-1 min-w-[140px] px-6 py-2.5 rounded-full text-white font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: PRIMARY }}
          >
            {sending ? '送信中...' : '送信する'}
          </button>
        )}
      </div>
    </form>
  );
}
