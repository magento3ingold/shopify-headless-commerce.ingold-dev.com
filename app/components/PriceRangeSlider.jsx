/**
 * Dual-handle price slider built from two native range inputs, so keyboard
 * support (arrows, Page Up/Down, Home/End), touch and screen reader
 * semantics come from the browser. The handles can never cross: the
 * minimum stops at the maximum and vice versa.
 *
 * Controlled: the parent owns the values and decides when to apply them.
 * @param {{
 *   bounds: {min: number; max: number};
 *   value: {min: number; max: number};
 *   step?: number;
 *   onChange: (value: {min: number; max: number}) => void;
 *   formatValue: (amount: number) => string;
 * }}
 */
export function PriceRangeSlider({
  bounds,
  value,
  step = 1,
  onChange,
  formatValue,
}) {
  const span = bounds.max - bounds.min || 1;
  const toPercent = (amount) => ((amount - bounds.min) / span) * 100;
  const start = toPercent(value.min);
  const end = toPercent(value.max);
  // When both handles meet, keep the one that can still move on top.
  const minOnTop = value.min > bounds.min + span / 2;

  return (
    <div className="relative h-6">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-line"
      />
      <div
        aria-hidden="true"
        className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-ink"
        style={{left: `${start}%`, right: `${100 - end}%`}}
      />
      <input
        type="range"
        aria-label="Minimum price"
        aria-valuetext={formatValue(value.min)}
        min={bounds.min}
        max={bounds.max}
        step={step}
        value={value.min}
        onChange={(event) =>
          onChange({
            min: Math.min(Number(event.target.value), value.max),
            max: value.max,
          })
        }
        className={`${THUMB_CLASSES} ${minOnTop ? 'z-20' : 'z-10'}`}
      />
      <input
        type="range"
        aria-label="Maximum price"
        aria-valuetext={formatValue(value.max)}
        min={bounds.min}
        max={bounds.max}
        step={step}
        value={value.max}
        onChange={(event) =>
          onChange({
            min: value.min,
            max: Math.max(Number(event.target.value), value.min),
          })
        }
        className={`${THUMB_CLASSES} ${minOnTop ? 'z-10' : 'z-20'}`}
      />
    </div>
  );
}

/**
 * Transparent, overlapping range inputs: only the thumbs take pointer
 * events, so each handle can be dragged although the inputs overlap.
 */
const THUMB_CLASSES = [
  'pointer-events-none absolute inset-0 m-0 h-6 w-full cursor-pointer appearance-none border-0 bg-transparent p-0 outline-none',
  // WebKit / Blink
  '[&::-webkit-slider-runnable-track]:h-6 [&::-webkit-slider-runnable-track]:bg-transparent',
  '[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:mt-0.5 [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-ink [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:transition-shadow',
  '[&:active::-webkit-slider-thumb]:cursor-grabbing [&:focus-visible::-webkit-slider-thumb]:shadow-[0_0_0_4px_rgb(0_0_0/0.15)]',
  // Firefox
  '[&::-moz-range-track]:bg-transparent',
  '[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-ink [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-sm',
  '[&:focus-visible::-moz-range-thumb]:shadow-[0_0_0_4px_rgb(0_0_0/0.15)]',
].join(' ');
