import React, { useState, useEffect } from 'react';

interface NumericInputProps {
  id?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  disabled?: boolean;
  dark?: boolean;
}

export const NumericInput: React.FC<NumericInputProps> = ({
  id,
  value,
  onChange,
  min = 1,
  max = 10000,
  step = 1,
  unit,
  className = '',
  inputClassName = '',
  placeholder,
  disabled = false,
  dark = false,
}) => {
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [text, setText] = useState<string>(value !== undefined && value !== null ? String(value) : '');

  // Only sync from parent value when NOT currently focused to allow seamless typing
  useEffect(() => {
    if (!isFocused) {
      setText(value !== undefined && value !== null ? String(value) : '');
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setText(raw);

    // If valid number within valid [min, max] range, update parent immediately
    const parsed = parseFloat(raw);
    if (!isNaN(parsed) && parsed >= min && parsed <= max) {
      onChange(parsed);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    // Select all text so typing immediately replaces existing value
    e.target.select();
  };

  const handleBlur = () => {
    setIsFocused(false);
    const parsed = parseFloat(text);
    if (isNaN(parsed) || parsed < min) {
      setText(String(min));
      onChange(min);
    } else if (parsed > max) {
      setText(String(max));
      onChange(max);
    } else {
      setText(String(parsed));
      onChange(parsed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  const defaultBaseTheme = dark
    ? 'bg-slate-900 text-white border-slate-700 placeholder-slate-500 focus:border-sky-400 focus:ring-sky-400'
    : 'bg-white text-slate-900 border-slate-300 placeholder-slate-400 focus:border-[#00529B] focus:ring-[#00529B]';

  return (
    <div className={`relative flex items-center ${className}`}>
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        value={text}
        onFocus={handleFocus}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full rounded border px-2.5 py-1.5 text-sm font-mono focus:ring-1 transition-colors ${defaultBaseTheme} ${
          unit ? 'pr-8' : ''
        } ${inputClassName}`}
      />
      {unit && (
        <span className={`pointer-events-none absolute right-2.5 text-[11px] font-mono font-bold select-none ${
          dark ? 'text-slate-400' : 'text-slate-500'
        }`}>
          {unit}
        </span>
      )}
    </div>
  );
};

