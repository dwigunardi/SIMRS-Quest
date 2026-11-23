import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { HighlightedCode } from '../HighlightedCode';
import { RichText, renderInline } from './RichText';
import type { CodeExample, ConceptSection } from '../../types';

type CopyState = 'idle' | 'copied' | 'failed';

function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<CopyState>('idle');

  useEffect(() => {
    if (state === 'idle') return undefined;
    const timer = window.setTimeout(() => setState('idle'), 1500);
    return () => window.clearTimeout(timer);
  }, [state]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      setState('failed');
    }
  };

  const label = state === 'copied' ? 'Tersalin' : state === 'failed' ? 'Gagal menyalin' : 'Salin';
  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="ml-auto inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-0.5 text-[11px] font-medium text-slate-400 transition hover:border-sky-500/40 hover:text-sky-200"
      aria-live="polite"
    >
      {state === 'copied' ? <Check className="h-3 w-3 text-emerald-400" aria-hidden /> : <Copy className="h-3 w-3" aria-hidden />}
      {label}
    </button>
  );
}

function ExampleSwitcher({ examples, heading }: { examples: CodeExample[]; heading: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = examples[activeIndex] ?? examples[0];
  if (!active) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-800 bg-slate-900/70 px-2 py-1.5">
        {examples.length > 1 ? (
          <div role="group" aria-label={`Pilih dialek contoh: ${heading}`} className="flex flex-wrap gap-1">
            {examples.map((example, index) => {
              const selected = index === activeIndex;
              return (
                <button
                  key={`${example.dialect}-${index}`}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setActiveIndex(index)}
                  className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition ${
                    selected ? 'bg-sky-500/20 text-sky-200 ring-1 ring-sky-500/40' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  {example.dialect}
                </button>
              );
            })}
          </div>
        ) : (
          <span className="px-1 text-[11px] font-medium text-sky-300">{active.dialect}</span>
        )}
        <CopyButton text={active.code} />
      </div>
      <HighlightedCode code={active.code} className="p-3" />
      {active.caption ? (
        <p className="border-t border-slate-800 px-3 py-2 text-xs leading-relaxed text-slate-400">{renderInline(active.caption)}</p>
      ) : null}
    </div>
  );
}

export function ConceptSectionCard({ section, index }: { section: ConceptSection; index: number }) {
  return (
    <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-sky-500/15 text-xs font-bold text-sky-300">{index + 1}</span>
        {section.heading}
      </h3>
      <RichText text={section.body} />
      {section.examples && section.examples.length > 0 ? <ExampleSwitcher examples={section.examples} heading={section.heading} /> : null}
    </section>
  );
}
