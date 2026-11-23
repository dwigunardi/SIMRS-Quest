/**
 * Verifikasi autocomplete editor (src/lib/sqlComplete.ts): konteks tabel/kolom/alias, kualifier `alias.`,
 * tidak muncul di dalam string/komentar, dan perilaku Enter pada saran yang sama persis dengan ketikan.
 */
import type { Database } from 'sql.js';
import { getCompletions, isNoopCompletion, type CompletionKind, type CompletionSchema } from '../../src/lib/sqlComplete';
import { getSchemaInfo } from '../../src/lib/sqlEngine';
import { assert } from './report';

interface Case {
  label: string;
  /** Teks editor; `|` menandai posisi caret. */
  text: string;
  explicit?: boolean;
  /** null = tidak boleh ada saran. */
  first?: { label: string; kind?: CompletionKind } | null;
  includes?: string[];
  excludes?: string[];
}

const CASES: readonly Case[] = [
  { label: 'awal statement → keyword', text: 'sel|', first: { label: 'SELECT', kind: 'keyword' } },
  { label: 'setelah FROM → tabel', text: 'SELECT * FROM pas|', first: { label: 'pasien', kind: 'table' } },
  { label: 'setelah JOIN → tabel', text: 'SELECT * FROM pasien p JOIN kun|', first: { label: 'kunjungan', kind: 'table' } },
  { label: 'alias. → kolom tabel alias', text: 'SELECT p.| FROM pasien p', first: { label: 'no_rm', kind: 'column' }, includes: ['nama', 'kota'], excludes: ['SELECT', 'id_poli'] },
  { label: 'alias.awalan', text: 'SELECT k.tgl| FROM kunjungan AS k', first: { label: 'tgl_kunjungan', kind: 'column' } },
  { label: 'tabel.kolom', text: 'SELECT billing.tot| FROM billing', first: { label: 'total_biaya' } },
  { label: 'kolom tabel yang disebut didahulukan', text: 'SELECT na| FROM dokter', first: { label: 'nama_dokter', kind: 'column' } },
  { label: 'WHERE memakai kolom tabel di FROM', text: 'SELECT * FROM pasien WHERE pen|', first: { label: 'penjamin', kind: 'column' } },
  { label: 'fungsi agregat', text: 'SELECT cou| FROM pasien', first: { label: 'COUNT', kind: 'function' } },
  { label: 'frasa multi-kata', text: 'SELECT kota, COUNT(*) FROM pasien gro|', includes: ['GROUP BY'] },
  { label: 'alias kolom di ORDER BY', text: 'SELECT kota, COUNT(*) AS jumlah FROM pasien GROUP BY kota ORDER BY jum|', first: { label: 'jumlah', kind: 'alias' } },
  { label: 'CTE ditawarkan setelah FROM', text: 'WITH rekap AS (SELECT 1) SELECT * FROM rek|', first: { label: 'rekap', kind: 'table' } },
  { label: 'koma di FROM → tabel', text: 'SELECT * FROM pasien, dok|', first: { label: 'dokter', kind: 'table' } },
  { label: 'statement kedua punya konteks sendiri', text: 'SELECT * FROM dokter; SELECT p.| FROM pasien p', first: { label: 'no_rm' } },
  { label: 'di dalam string → tidak ada saran', text: "SELECT * FROM pasien WHERE kota = 'Ba|", first: null },
  { label: 'di dalam komentar → tidak ada saran', text: '-- pilih pas|', first: null },
  { label: 'di dalam komentar blok → tidak ada saran', text: '/* pas| */ SELECT 1', first: null },
  { label: 'setelah komentar blok tertutup → ada saran', text: '/* catatan */ sel|', first: { label: 'SELECT' } },
  { label: 'string tertutup → ada saran', text: "SELECT * FROM pasien WHERE kota = 'Bandung' an|", first: { label: 'AND', kind: 'keyword' } },
  { label: 'angka desimal tidak memicu kualifier', text: 'SELECT 1.|', first: null },
  { label: 'tanpa awalan & tidak eksplisit → diam', text: 'SELECT |', first: null },
  { label: 'Ctrl+Space tanpa awalan → saran', text: 'SELECT * FROM pasien WHERE |', explicit: true, first: { label: 'no_rm', kind: 'column' } },
  { label: 'alias tak dikenal → diam', text: 'SELECT x.| FROM pasien p', first: null },
  { label: 'awalan angka → diam', text: 'SELECT 12|', first: null },
  { label: 'substring: "rm" menemukan no_rm', text: 'SELECT rm| FROM pasien', first: { label: 'no_rm' } },
  { label: 'CREATE INDEX … ON → tabel', text: 'CREATE INDEX idx ON diag|', first: { label: 'diagnosa', kind: 'table' } },
  // Posisi alias baru: Enter/Tab tidak boleh mengganti alias yang sedang diketik.
  { label: 'alias tabel 1 huruf → diam', text: 'SELECT * FROM pasien p|', first: null },
  { label: 'alias JOIN → diam', text: 'SELECT * FROM pasien p JOIN kunjungan k|', first: null },
  { label: 'setelah AS → diam', text: 'SELECT SUM(total_biaya) AS total| FROM billing', first: null },
  { label: 'setelah AS (kolom) → diam', text: 'SELECT nama AS n| FROM pasien', first: null },
  { label: 'kata kunci setelah nama tabel (≥3 huruf)', text: 'SELECT kota FROM pasien whe|', first: { label: 'WHERE', kind: 'keyword' } },
  // Kata yang sama persis dengan ketikan selalu paling atas (Enter = baris baru).
  { label: 'NULL di atas NULLIF', text: 'SELECT * FROM kunjungan WHERE no_sep IS NULL|', first: { label: 'NULL', kind: 'keyword' } },
  { label: 'setelah kolom: IN di atas INSTR', text: "SELECT * FROM pasien WHERE nama in|", first: { label: 'IN', kind: 'keyword' } },
  { label: 'setelah kolom: LIKE di atas LIKELIHOOD', text: "SELECT * FROM pasien WHERE nama like|", first: { label: 'LIKE', kind: 'keyword' } },
  { label: 'setelah tabel: GROUP BY di atas GROUP_CONCAT', text: 'SELECT kota FROM pasien group|', first: { label: 'GROUP BY', kind: 'keyword' } },
  { label: 'alias JOIN ditawarkan', text: 'SELECT * FROM pasien p JOIN kunjungan k ON k.no_rm = |', explicit: true, includes: ['p', 'k'] },
];

function run(schema: CompletionSchema, c: Case) {
  const caret = c.text.indexOf('|');
  const text = c.text.slice(0, caret) + c.text.slice(caret + 1);
  return getCompletions(text, caret, schema, c.explicit ?? false);
}

export function verifySqlComplete(db: Database): void {
  const schema: CompletionSchema = { tables: getSchemaInfo(db).map((t) => ({ name: t.name, columns: t.columns.map((col) => ({ name: col.name, type: col.type })) })) };
  for (const c of CASES) {
    const result = run(schema, c);
    const where = `autocomplete "${c.label}"`;
    const labels = result?.items.map((item) => item.label) ?? [];
    if (c.first === null) {
      assert(result === null, `${where}: seharusnya tanpa saran, didapat ${labels.slice(0, 5).join(', ')}`);
      continue;
    }
    if (c.first) {
      const first = result?.items[0];
      assert(first?.label === c.first.label, `${where}: saran pertama '${first?.label ?? '-'}', seharusnya '${c.first.label}' (${labels.slice(0, 5).join(', ')})`);
      if (c.first.kind) assert(first?.kind === c.first.kind, `${where}: jenis '${first?.kind ?? '-'}', seharusnya '${c.first.kind}'`);
    }
    for (const label of c.includes ?? []) assert(labels.includes(label), `${where}: '${label}' tidak ada di saran (${labels.slice(0, 8).join(', ')})`);
    for (const label of c.excludes ?? []) assert(!labels.includes(label), `${where}: '${label}' tidak boleh ada di saran`);
  }

  // Fungsi disisipkan dengan "()" dan caret di dalamnya; Enter pada kata yang sudah lengkap = baris baru.
  const fn = run(schema, { label: 'fn', text: 'SELECT su| FROM billing' })?.items.find((item) => item.label === 'SUM');
  assert(fn?.insert === 'SUM()' && fn.caretBack === 1, 'autocomplete: fungsi harus disisipkan sebagai "SUM()" dengan caret di dalam kurung');
  const typed = run(schema, { label: 'noop', text: 'SELECT * FROM pasien WHERE kota = 1 AND|' });
  const exact = typed?.items.find((item) => item.label === 'AND');
  assert(typed !== null && exact !== undefined && isNoopCompletion(typed, exact), 'autocomplete: saran yang sama persis dengan ketikan harus dianggap no-op');
  // Saran di tengah kata mengganti seluruh kata ("na|ma" → "nama", bukan "namama").
  const middle = getCompletions('SELECT nama FROM pasien', 9, schema);
  assert(middle !== null && middle.from === 7 && middle.to === 11, `autocomplete: rentang ganti di tengah kata ${middle?.from ?? '-'}..${middle?.to ?? '-'}, seharusnya 7..11`);
  console.log(`  ${CASES.length + 3} kasus autocomplete ✓`);
}
