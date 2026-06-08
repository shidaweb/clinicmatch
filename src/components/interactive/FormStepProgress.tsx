interface Props {
  step: number;
  total?: number;
  duration?: string;
}

export default function FormStepProgress({ step, total = 3, duration = '約2分' }: Props) {
  const current = String(step).padStart(2, '0');
  const max = String(total).padStart(2, '0');

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-baseline gap-1 shrink-0">
        <span
          className="text-3xl font-semibold text-gold tabular-nums"
          style={{ fontFamily: '"Shippori Mincho", "Noto Serif JP", serif' }}
        >
          {current}
        </span>
        <span className="text-sm text-[#7A5C63]">/ {max}</span>
      </div>
      <div className="flex flex-1 gap-1.5" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={total}>
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className="h-[3px] flex-1 rounded-full transition-colors"
            style={{ backgroundColor: i < step ? '#A86A77' : '#EADCD4' }}
          />
        ))}
      </div>
      <span className="text-xs text-[#7A5C63] shrink-0">{duration}</span>
    </div>
  );
}
