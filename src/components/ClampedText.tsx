import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export interface ClampedTextProps {
  text: string;
  /** Jumlah baris yang ditampilkan saat dilipat. */
  lines: 3 | 4 | 5 | 6;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  className?: string;
  /** Untuk aria-label tombol, mis. "skenario". */
  label: string;
}

const CLAMP_CLASS: Record<ClampedTextProps['lines'], string> = {
  3: 'line-clamp-3',
  4: 'line-clamp-4',
  5: 'line-clamp-5',
  6: 'line-clamp-6',
};

/**
 * Teks yang bisa dilipat. Tombol "Selengkapnya/Lipat" hanya muncul bila teks benar-benar melebihi
 * `lines` baris pada lebar panel saat ini (diukur, bukan ditebak dari jumlah karakter).
 */
export function ClampedText({ text, lines, expanded, onExpandedChange, className = '', label }: ClampedTextProps): JSX.Element {
  const ref = useRef<HTMLParagraphElement>(null);
  const [overflows, setOverflows] = useState(false);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    if (expanded) {
      // Ukur tinggi versi terlipat tanpa mengubah tampilan: bandingkan dengan tinggi baris × lines.
      const lineHeight = Number.parseFloat(getComputedStyle(el).lineHeight) || 0;
      setOverflows(lineHeight > 0 && el.scrollHeight > lineHeight * lines + 1);
      return;
    }
    setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [expanded, lines]);

  useLayoutEffect(() => {
    measure();
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure, text]);

  const clamped = !expanded;
  return (
    <div>
      <p ref={ref} className={`${className} ${clamped ? CLAMP_CLASS[lines] : ''}`}>
        {text}
      </p>
      {overflows ? (
        <button
          type="button"
          onClick={() => onExpandedChange(!expanded)}
          aria-expanded={expanded}
          aria-label={expanded ? `Lipat ${label}` : `Tampilkan ${label} selengkapnya`}
          className="mt-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" aria-hidden /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden />}
          {expanded ? 'Lipat' : 'Selengkapnya'}
        </button>
      ) : null}
    </div>
  );
}
