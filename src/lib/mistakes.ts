/**
 * Peta kelemahan — bagian 1: mengklasifikasikan setiap percobaan yang belum benar menjadi satu JENIS kesalahan.
 * Murni (tanpa browser), jadi bisa diuji di scripts/verify.
 */
import { EMPTY_QUERY_FAILURE, QUERY_CANCELLED, QUERY_CRASHED, QUERY_TIMEOUT, RESULT_TOO_LARGE } from './sqlEngine';
import { SOLUTION_BUG_MESSAGE } from './validator';
import type { CheckResult, MismatchReason, Mission } from '../types';

export type MistakeKind =
  | 'syntax'
  | 'names'
  | 'aggregate'
  | 'window'
  | 'columns'
  | 'rows-extra'
  | 'rows-missing'
  | 'values'
  | 'order'
  | 'construct'
  | 'dml'
  | 'ddl'
  | 'performance'
  | 'security'
  | 'reading'
  | 'concept';

export interface MistakeEvent {
  missionId: string;
  kind: MistakeKind;
  /** ISO timestamp. */
  at: string;
}

export interface MistakeInfo {
  label: string;
  /** Penjelasan singkat penyebab umum (boleh memakai `kode`). */
  description: string;
  /**
   * Materi yang membantu. Kosong = pakai materi misi tempat kesalahan terjadi (mis. konstruksi wajib, kuis).
   */
  articles: readonly string[];
}

export const MISTAKE_INFO: Record<MistakeKind, MistakeInfo> = {
  syntax: {
    label: 'Penulisan sintaks',
    description: 'Query tidak bisa di-parse: kata kunci salah tulis, koma/kurung kurang, atau urutan klausa keliru.',
    articles: ['urutan-eksekusi', 'select'],
  },
  names: {
    label: 'Nama tabel, kolom & alias',
    description: 'Nama yang tidak ada, salah eja, alias yang belum didefinisikan, atau kolom ambigu di JOIN.',
    articles: ['select', 'inner-join'],
  },
  aggregate: {
    label: 'Agregat & GROUP BY',
    description: 'COUNT/SUM/AVG di tempat yang salah (mis. di WHERE) atau GROUP BY yang tidak cocok dengan SELECT.',
    articles: ['having', 'group-by', 'agregasi'],
  },
  window: {
    label: 'Window function',
    description: 'Window function dipakai di WHERE/GROUP BY atau sintaks OVER (…) belum tepat.',
    articles: ['window-peringkat', 'window-agregat'],
  },
  columns: {
    label: 'Kolom hasil (jumlah, urutan, nama)',
    description: 'Hasil punya kolom yang kurang/berlebih, urutan kolom tertukar, atau alias tidak sesuai tugas.',
    articles: ['select'],
  },
  'rows-extra': {
    label: 'Baris berlebih',
    description: 'Filter kurang ketat (AND/OR, NULL), DISTINCT terlupa, atau JOIN menggandakan baris.',
    articles: ['where', 'join-fan-out', 'distinct'],
  },
  'rows-missing': {
    label: 'Baris kurang',
    description: 'Filter terlalu ketat, perbandingan teks peka huruf besar/kecil, atau INNER JOIN membuang baris yang seharusnya ada (perlu LEFT JOIN).',
    articles: ['where', 'left-join', 'null'],
  },
  values: {
    label: 'Nilai & perhitungan',
    description: 'Jumlah baris sudah benar tetapi isinya salah: agregat, pembagian bilangan bulat, CASE, atau kolom yang keliru.',
    articles: ['agregasi', 'angka-pembagian', 'case-when'],
  },
  order: {
    label: 'Pengurutan',
    description: 'Isi benar tetapi urutan salah: ASC/DESC, kunci urutan, atau tie-breaker.',
    articles: ['order-limit'],
  },
  construct: {
    label: 'Konstruksi wajib',
    description: 'Hasil sudah benar, tetapi teknik yang sedang dilatih (CTE, OVER, transaksi, …) belum dipakai.',
    articles: [],
  },
  dml: {
    label: 'DML, constraint & transaksi',
    description: 'Perubahan data melanggar constraint, mengenai baris yang salah, atau transaksi dibiarkan terbuka / tidak di-COMMIT.',
    articles: ['transaksi', 'update-delete', 'insert'],
  },
  ddl: {
    label: 'Desain tabel & DDL',
    description: 'Struktur tabel, constraint (PRIMARY KEY, FOREIGN KEY, UNIQUE, CHECK, DEFAULT), view, atau trigger belum sesuai aturan yang diminta.',
    articles: ['create-table', 'view', 'trigger'],
  },
  performance: {
    label: 'Index & query sargable',
    description: 'Index belum dibuat atau tidak terpakai karena kolom dibungkus fungsi.',
    articles: ['index', 'sargable'],
  },
  security: {
    label: 'SQL injection',
    description: 'Payload belum berhasil menembus query rentan di lab keamanan.',
    articles: ['sql-injection'],
  },
  reading: {
    label: 'Membaca query (tebak hasil)',
    description: 'Salah menebak hasil query — biasanya karena urutan eksekusi atau perilaku NULL/DISTINCT/agregat.',
    articles: ['urutan-eksekusi'],
  },
  concept: {
    label: 'Kuis konsep',
    description: 'Jawaban kuis kartu konsep belum tepat.',
    articles: [],
  },
};

/** true jika `value` adalah jenis kesalahan yang dikenal (aman dari kunci prototipe seperti "constructor"). */
export function isMistakeKind(value: string): value is MistakeKind {
  return Object.hasOwn(MISTAKE_INFO, value);
}

/** Jenis kesalahan dari pesan error mentah SQLite. */
export function classifySqlError(rawError: string): MistakeKind {
  const e = rawError.toLowerCase();
  if (/misuse of window function|window function/.test(e)) return 'window';
  if (/misuse of aggregate|aggregate functions are not allowed|having clause|group by clause/.test(e)) return 'aggregate';
  if (/no such (column|table|function)|ambiguous column|no such index/.test(e)) return 'names';
  if (/constraint failed|transaction|readonly|cannot (commit|rollback)/.test(e)) return 'dml';
  return 'syntax';
}

const REASON_KIND: Partial<Record<MismatchReason, MistakeKind>> = {
  'column-count': 'columns',
  'column-names': 'columns',
  'cell-values': 'values',
  'row-order': 'order',
  'missing-construct': 'construct',
  'open-transaction': 'dml',
  'transaction-flow': 'dml',
  'index-missing': 'performance',
  'plan-scan': 'performance',
  'goal-not-met': 'security',
  'quiz-wrong': 'concept',
  'predict-wrong': 'reading',
  'schema-object': 'ddl',
  'schema-structure': 'ddl',
  'probe-mismatch': 'ddl',
};

/**
 * Jenis kesalahan sebuah hasil penilaian (null jika benar). `mission` dipakai untuk konteks: misi 'state' (DML) yang
 * salah isi tabel dihitung sebagai 'dml', misi lab injection selalu 'security'.
 */
export function classifyCheck(mission: Mission, check: CheckResult): MistakeKind | null {
  if (check.kind === 'correct') return null;
  // Bukan percobaan sungguhan: editor kosong, solusi referensi sendiri yang gagal (bug data misi), atau dibatalkan user.
  if (check.kind === 'error' && (check.rawError === EMPTY_QUERY_FAILURE.rawError || check.friendlyError === SOLUTION_BUG_MESSAGE || check.rawError === QUERY_CANCELLED)) {
    return null;
  }
  // Query yang tak pernah selesai / hasilnya meledak: hampir selalu rekursi tanpa syarat berhenti atau JOIN tanpa syarat.
  const runaway = check.kind === 'error' && (check.rawError === QUERY_TIMEOUT || check.rawError.startsWith(RESULT_TOO_LARGE) || check.rawError.startsWith(QUERY_CRASHED));
  if (runaway) return 'rows-extra';
  if (mission.kind === 'injection') return 'security';
  if (check.kind === 'error') return classifySqlError(check.rawError);
  const reason = check.compare.reason;
  if (reason === 'row-count') {
    if (mission.kind === 'sql' && mission.grading?.type === 'state') return 'dml';
    const actual = check.actual?.rows.length ?? 0;
    const expected = check.expected?.rows.length ?? 0;
    return actual > expected ? 'rows-extra' : 'rows-missing';
  }
  if (reason === 'no-result') return 'columns';
  if (mission.kind === 'sql' && mission.grading?.type === 'state' && (reason === 'cell-values' || reason === 'row-order')) return 'dml';
  return (reason && REASON_KIND[reason]) ?? 'values';
}
