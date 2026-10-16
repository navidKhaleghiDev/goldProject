'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

type OtpCodeInputProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  invalid?: boolean;
};

function normalizeDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
    .replace(/\D/g, '')
    .slice(0, 6);
}

export const OtpCodeInput = forwardRef<HTMLInputElement, OtpCodeInputProps>(function OtpCodeInput(
  { value, onChange, onBlur, invalid },
  ref
) {
  return (
    <div className="otp-code-input group relative" dir="ltr">
      <div className="grid grid-cols-6 gap-2" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => (
          <span
            key={index}
            className={cn(
              'grid aspect-square min-w-0 place-items-center rounded-md text-xl font-semibold tabular-nums',
              invalid ? 'bg-red-50 text-[var(--danger)]' : 'bg-[var(--teal-50)]',
              index === Math.min(value.length, 5) && 'group-focus-within:bg-[var(--gold-300)]'
            )}
          >
            {value[index] ?? ''}
          </span>
        ))}
      </div>
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(event) => onChange(normalizeDigits(event.target.value))}
        onPaste={(event) => {
          event.preventDefault();
          onChange(normalizeDigits(event.clipboardData.getData('text')));
        }}
        onBlur={onBlur}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        aria-label="کد تأیید شش رقمی"
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? 'otp-error' : undefined}
        className="absolute inset-0 h-full w-full cursor-text opacity-0"
      />
    </div>
  );
});
