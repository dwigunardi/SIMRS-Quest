/**
 * Contoh untuk baris C6a "Jalankan query sungguhan": satu contoh per tab latihan (Query, Perbaiki Query, Tebak Hasil,
 * Lab Injection, Playground). SEMUA isinya diambil dari data yang sudah diperiksa `npm run verify` di lib/content.ts —
 * PRACTICE.tabs (misi sungguhan: kode, tabel hasil, pesan), TABLE_PREVIEWS (baris pertama tabel latihan), STUCK —
 * jadi tidak ada tabel, angka, atau pesan karangan di sini. Berkas ini hanya MENYUSUN ULANG data itu menjadi tiga kolom
 * mini: input yang dibaca query, hasil query di editor, dan hasil yang seharusnya.
 */
import { PRACTICE, PRACTICE_TABLES, STUCK, TABLE_PREVIEWS, type PracticeTabId, type ResultTable } from '../../../lib/content';
import type { CodeLineMark } from '../../../ui/CodeWindow';

/** Penilaian contoh: cocok, belum cocok, atau tanpa penilaian (Playground). */
export type RunVerdict = 'match' | 'mismatch' | 'none';

export interface RunTable {
  /** Judul kecil di atas tabel, mis. "Mode rentan" atau "Pilihan B". */
  caption?: string;
  /** Kolom + baris (boleh cuplikan: hanya beberapa baris pertama). */
  table: ResultTable;
  /** Jumlah baris SEBENARNYA dari query-nya. */
  rows: number;
  /** Keterangan di bawah tabel, mis. "Hasil kosong: 0 baris.". */
  note?: string;
}

export type RunInput =
  /** Cuplikan tabel latihan yang dibaca query. */
  | { kind: 'table'; name: string; total: number; table: ResultTable }
  /** Isian formulir (Lab Injection). */
  | { kind: 'field'; label: string; value: string };

/**
 * Judul (dan keterangan) kartu sukses yang dipakai APLIKASI untuk jenis misi yang tidak dinilai "hasil vs Expected
 * Output" — scripts/verify/courses.ts memastikan teksnya ada di layar misinya (src/components/workspaces/*).
 * - Tebak Hasil: query tidak dijalankan; kamu memilih tabel hasilnya (PredictWorkspace).
 * - Lab Injection: kebocoran di mode rentan justru TUJUAN misinya (InjectionWorkspace: "Serangan berhasil!").
 */
export const APP_SUCCESS = {
  predict: { title: 'Tebakanmu tepat!', detail: 'Kamu membaca query seperti database menjalankannya' },
  injection: { title: 'Serangan berhasil!' },
} as const;

export interface RunExample {
  id: PracticeTabId;
  /** "Tier 1 · Misi 2" (tanpa label untuk Playground). */
  label?: string;
  title: string;
  fileName: string;
  code: string;
  /** Tanda baris setelah dijalankan (bug merah / perbaikan hijau). */
  marks?: Readonly<Record<number, CodeLineMark>>;
  input: RunInput;
  yours: RunTable;
  /** Hasil yang seharusnya, atau keterangan bila contoh ini tidak dinilai. */
  expected: RunTable | { text: string };
  verdict: RunVerdict;
  /** Judul & keterangan kartu penilaian (verdict match/mismatch). */
  verdictText?: { title: string; detail?: string };
  /** Konsol menyebut penilaian berdasarkan hasil hanya untuk misi SQL yang memang dinilai begitu. */
  graded: boolean;
  /**
   * Query-nya dijalankan (fase "Menjalankan query…" + konsol eksekusi). false untuk Tebak Hasil: query dibaca, tidak
   * dijalankan — konsolnya mengatakan itu (run.consoleNoRun).
   */
  executes: boolean;
  xp?: number;
  /** Tab Perbaiki Query: versi setelah diperbaiki (tombol "Lihat perbaikan"). */
  fixed?: RunExample;
}

const TABS = PRACTICE.tabs;

/** Cuplikan tabel latihan `name` (baris pertama, persis seperti di database latihan) + jumlah baris tabelnya. */
function previewOf(name: string): RunInput {
  const table = TABLE_PREVIEWS[name] ?? { columns: [], rows: [] };
  const total = PRACTICE_TABLES.find((entry) => entry.name === name)?.rows ?? table.rows.length;
  return { kind: 'table', name, total, table };
}

/** Ambil sebagian kolom sebuah tabel (urutan kolom mengikuti `columns`). */
function project(table: ResultTable, columns: readonly string[]): ResultTable {
  const indexes = columns.map((column) => table.columns.indexOf(column));
  if (indexes.some((index) => index < 0)) return table;
  return { columns, rows: table.rows.map((row) => indexes.map((index) => row[index] ?? '')) };
}

/** Baris (mulai dari 1) pada `after` yang tidak ada di `before` — penanda baris yang diperbaiki. */
function changedLines(before: string, after: string): Record<number, CodeLineMark> {
  const old = new Set(before.split('\n').map((line) => line.trim()));
  const marks: Record<number, CodeLineMark> = {};
  after.split('\n').forEach((line, index) => {
    if (line.trim() !== '' && !old.has(line.trim())) marks[index + 1] = 'success';
  });
  return marks;
}

function correct(): RunExample['verdictText'] {
  return { title: PRACTICE.verdict.correct, detail: PRACTICE.verdict.correctDetail };
}

function queryExample(): RunExample {
  const tab = TABS.query;
  return {
    id: 'query',
    label: tab.tierLabel,
    title: tab.missionTitle,
    fileName: tab.fileName,
    code: tab.code,
    input: previewOf('pasien'),
    yours: { table: tab.result, rows: tab.result.rows.length },
    expected: { table: tab.result, rows: tab.result.rows.length },
    verdict: 'match',
    verdictText: correct(),
    graded: true,
    executes: true,
    xp: tab.xp,
  };
}

function fixExample(): RunExample {
  const tab = TABS.fix;
  const expected: RunTable = { table: tab.result, rows: tab.result.rows.length };
  const fixed: RunExample = {
    id: 'fix',
    label: tab.tierLabel,
    title: tab.missionTitle,
    fileName: PRACTICE.ui.fixFile,
    code: tab.fixedCode,
    marks: changedLines(tab.buggyCode, tab.fixedCode),
    input: previewOf('billing'),
    yours: expected,
    expected,
    verdict: 'match',
    verdictText: correct(),
    graded: true,
    executes: true,
    xp: tab.xp,
  };
  return {
    id: 'fix',
    label: tab.tierLabel,
    title: tab.missionTitle,
    fileName: tab.fileName,
    code: tab.buggyCode,
    marks: Object.fromEntries(tab.bugs.map((bug) => [bug.line, 'error' as const])),
    input: previewOf('billing'),
    // Query dari rekan mengembalikan 0 baris (buggyNote — diperiksa verifikasi).
    yours: { table: { columns: tab.result.columns, rows: [] }, rows: 0, note: tab.buggyNote },
    expected,
    verdict: 'mismatch',
    verdictText: { title: STUCK.example.wrongLabel, detail: tab.buggyNote },
    graded: true,
    executes: true,
    fixed,
  };
}

function predictExample(): RunExample {
  const tab = TABS.predict;
  const index = tab.options.findIndex((option) => option.correct);
  const answer = tab.options[index];
  const table = answer?.table ?? { columns: [], rows: [] };
  const letter = String.fromCodePoint(65 + Math.max(index, 0));
  return {
    id: 'predict',
    label: tab.tierLabel,
    title: tab.missionTitle,
    fileName: tab.fileName,
    code: tab.code,
    input: previewOf('pasien'),
    yours: { caption: tab.optionLabel(letter), table, rows: table.rows.length },
    expected: { caption: tab.optionLabel(letter), table, rows: table.rows.length, note: answer?.why },
    verdict: 'match',
    // Kartu sukses Tebak Hasil di aplikasi — bukan "Hasil cocok dengan Expected Output" (query-nya tidak dijalankan).
    verdictText: { title: APP_SUCCESS.predict.title, detail: APP_SUCCESS.predict.detail },
    graded: false,
    executes: false,
    xp: tab.xp,
  };
}

function injectionExample(): RunExample {
  const tab = TABS.injection;
  const pasien = TABLE_PREVIEWS.pasien ?? { columns: [], rows: [] };
  // Mode rentan: SELECT no_rm, nama, kota FROM pasien WHERE … OR '1'='1' → semua pasien, urut seperti tabelnya.
  const leaked = project(pasien, ['no_rm', 'nama', 'kota']);
  // Dua query yang disusun server dari input yang sama: disambung mentah (rentan) dan prepared statement (aman).
  const code = [`-- ${tab.vulnerable.label}`, tab.builtSql, '', `-- ${tab.safe.label}`, tab.safeSql].join('\n');
  // Nama tabel yang ditampilkan portal (tabel setelah FROM di query server).
  const table = /\bFROM\s+([a-z_]+)/i.exec(tab.builtSql)?.[1] ?? '';
  return {
    id: 'injection',
    label: tab.tierLabel,
    title: tab.missionTitle,
    fileName: tab.fileName,
    code,
    marks: { 2: 'error', 5: 'success' },
    input: { kind: 'field', label: tab.inputLabel, value: tab.payload },
    // Dua kolom = dua mode server (judulnya run.columnsByTab.injection), BUKAN "hasil kamu vs seharusnya": di misi ini
    // kebocoran di mode rentan adalah tujuannya, dan mode aman hanya uji lanjutan yang memang dirancang gagal.
    yours: { caption: table, table: leaked, rows: tab.vulnerable.rows },
    expected: { caption: table, table: { columns: leaked.columns, rows: [] }, rows: tab.safe.rows, note: tab.safe.outcome },
    verdict: 'match',
    verdictText: { title: APP_SUCCESS.injection.title, detail: tab.vulnerable.outcome },
    graded: false,
    executes: true,
    xp: tab.xp,
  };
}

function playgroundExample(): RunExample {
  const tab = TABS.playground;
  return {
    id: 'playground',
    title: tab.title,
    fileName: tab.fileName,
    code: tab.code,
    input: previewOf('pasien'),
    yours: { table: tab.result, rows: tab.result.rows.length },
    expected: { text: tab.task },
    verdict: 'none',
    graded: false,
    executes: true,
  };
}

/** Contoh per tab latihan. */
export const RUN_EXAMPLES: Readonly<Record<PracticeTabId, RunExample>> = {
  query: queryExample(),
  fix: fixExample(),
  predict: predictExample(),
  injection: injectionExample(),
  playground: playgroundExample(),
};

/** Tinggi editor yang dipesan (baris) supaya semua contoh sama tinggi dan tata letak tidak melompat saat berganti tab. */
export const RUN_MIN_LINES = Math.max(
  ...Object.values(RUN_EXAMPLES).flatMap((example) => [example.code, example.fixed?.code ?? ''].map((code) => code.split('\n').length)),
);
