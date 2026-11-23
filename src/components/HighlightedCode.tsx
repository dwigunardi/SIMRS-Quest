import { useMemo } from 'react';
import { tokenizeSql, type SqlTokenType } from '../lib/sqlHighlight';

/** Kelas warna per jenis token — dipakai bersama oleh editor, blok solusi, dan contoh kode. */
export const TOKEN_CLASS: Record<SqlTokenType, string> = {
  keyword: 'text-emerald-400 font-semibold',
  function: 'text-teal-300',
  string: 'text-amber-300',
  number: 'text-sky-300',
  comment: 'text-slate-500 italic',
  operator: 'text-slate-400',
  punctuation: 'text-slate-400',
  identifier: 'text-slate-200',
  whitespace: '',
};

/** Nama tabel yang dikenali di editor (identifier yang cocok dengan skema). */
export const TABLE_NAME_CLASS = 'text-fuchsia-300';

export interface HighlightedCodeProps {
  code: string;
  className?: string;
}

/**
 * Blok kode read-only dengan syntax highlighting. Tokenizer SQL bersifat lossless,
 * sehingga juga aman untuk potongan kode non-SQL (PHP, Java, Python, dsb.) — teks
 * selalu tampil utuh walau pewarnaannya tidak sempurna.
 */
export function HighlightedCode({ code, className = 'p-4' }: HighlightedCodeProps) {
  const tokens = useMemo(() => tokenizeSql(code), [code]);
  return (
    <pre className={`scrollbar-thin overflow-x-auto whitespace-pre font-mono text-[13px] leading-relaxed ${className}`}>
      <code>
        {tokens.map((token, index) =>
          token.type === 'whitespace' ? (
            token.text
          ) : (
            <span key={index} className={TOKEN_CLASS[token.type]}>
              {token.text}
            </span>
          ),
        )}
      </code>
    </pre>
  );
}
