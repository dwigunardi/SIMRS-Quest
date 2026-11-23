import type { ReactNode } from 'react';

/**
 * Teks penjelasan sederhana: paragraf dipisah baris kosong, `kode` dalam backtick → <code>,
 * **tebal** → <strong>, dan paragraf yang semua barisnya diawali "- " → daftar berpoin.
 */

const INLINE_PATTERN = /(`[^`]+`|\*\*[^*]+\*\*)/;
const BULLET_PATTERN = /^\s*[-•]\s+/;

export function renderInline(text: string, codeClass = 'text-sky-200'): ReactNode[] {
  return text.split(INLINE_PATTERN).map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={index} className={`rounded bg-slate-800 px-1 py-px font-mono text-[0.85em] ${codeClass}`}>
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={index} className="font-semibold text-slate-100">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

function Paragraph({ text }: { text: string }) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
  const isList = lines.length > 0 && lines.every((line) => BULLET_PATTERN.test(line));
  if (isList) {
    return (
      <ul className="list-disc space-y-1 pl-5">
        {lines.map((line, index) => (
          <li key={index}>{renderInline(line.replace(BULLET_PATTERN, ''))}</li>
        ))}
      </ul>
    );
  }
  return <p className="whitespace-pre-line">{renderInline(text)}</p>;
}

export function RichText({ text, className = '' }: { text: string; className?: string }) {
  const paragraphs = text
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== '');
  return (
    <div className={`space-y-2.5 text-sm leading-relaxed text-slate-300 ${className}`}>
      {paragraphs.map((paragraph, index) => (
        <Paragraph key={index} text={paragraph} />
      ))}
    </div>
  );
}
