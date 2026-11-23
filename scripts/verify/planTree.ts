/**
 * Verifikasi visualisasi query plan (src/lib/planTree.ts) — fitur Explain di Playground.
 *
 * 1. Kasus tertarget: bentuk plan SQLite yang dikenal → jenis langkah, tone, tabel, ringkasan, saran.
 * 2. Tanpa efek samping: Explain tidak pernah mengubah data/skema (DML, DDL, transaksi).
 * 3. Sapuan korpus: semua solutionSql misi + semua jawaban test case → tidak ada exception,
 *    tidak ada langkah 'other' (baris plan tak dikenali), DB tidak berubah.
 */
import type { Database, SqlJsStatic } from 'sql.js';
import { MISSIONS } from '../../src/data/missions';
import { explainScript, flattenPlan } from '../../src/lib/planTree';
import { createSeededDatabase, getSchemaVersion, getTotalChanges } from '../../src/lib/sqlEngine';
import type { PlanNode, PlanNodeKind, PlanReport, PlanTone, StatementPlan } from '../../src/types';
import { MISSION_TEST_CASES } from '../test-cases';
import { assert, fail } from './report';

type PlanStatement = Extract<StatementPlan, { status: 'plan' }>;

interface NodeExpectation {
  kind: PlanNodeKind;
  table?: string;
  tone?: PlanTone;
  innerLoop?: boolean;
  repeated?: boolean;
  covering?: boolean;
  fkCheck?: boolean;
  stopsEarly?: boolean;
  title?: string;
  suggestion?: RegExp;
}

interface PlanCase {
  label: string;
  /** SQL yang dijalankan dulu di DB segar khusus kasus ini (mis. CREATE TABLE/VIEW/INDEX). */
  setup?: string;
  sql: string;
  tone: PlanTone;
  headline?: RegExp;
  nodes: NodeExpectation[];
  /** Jenis langkah yang TIDAK boleh muncul. */
  absent?: PlanNodeKind[];
  tip?: RegExp;
  noTip?: RegExp;
  /** Tidak boleh ada saran CREATE INDEX sama sekali. */
  noSuggestion?: boolean;
}

const PLAN_CASES: readonly PlanCase[] = [
  {
    label: 'SELECT tanpa WHERE → full scan wajar',
    sql: 'SELECT * FROM pasien;',
    tone: 'warn',
    headline: /Full table scan pada pasien \(20 baris\)/,
    nodes: [{ kind: 'full-scan', table: 'pasien', tone: 'warn', innerLoop: false }],
    tip: /tanpa WHERE memang harus membaca semua baris/,
  },
  {
    label: 'cari lewat PRIMARY KEY TEXT (autoindex)',
    sql: "SELECT * FROM pasien WHERE no_rm = 'RM-0001';",
    tone: 'good',
    nodes: [{ kind: 'index-search', table: 'pasien', tone: 'good' }],
    absent: ['full-scan'],
  },
  {
    label: 'cari lewat INTEGER PRIMARY KEY (rowid)',
    sql: 'SELECT * FROM billing WHERE id_billing = 3;',
    tone: 'good',
    nodes: [{ kind: 'rowid-search', table: 'billing' }],
  },
  {
    label: 'alias + rentang BETWEEN → SEARCH idx_kunjungan_tgl',
    sql: "SELECT * FROM kunjungan k WHERE k.tgl_kunjungan BETWEEN '2026-10-01' AND '2026-10-31';",
    tone: 'good',
    nodes: [{ kind: 'index-search', table: 'kunjungan' }],
  },
  {
    label: 'fungsi membungkus kolom ber-index → full scan + tip',
    sql: "SELECT * FROM kunjungan WHERE strftime('%Y-%m', tgl_kunjungan) = '2026-10';",
    tone: 'warn',
    nodes: [{ kind: 'full-scan', table: 'kunjungan' }],
    tip: /tgl_kunjungan dibungkus fungsi strftime/,
  },
  {
    label: 'LIKE → full scan + tip LIKE',
    sql: "SELECT * FROM pasien WHERE nama LIKE 'B%';",
    tone: 'warn',
    nodes: [{ kind: 'full-scan', table: 'pasien' }],
    tip: /LIKE \(yang tidak peka huruf besar\/kecil\) tidak bisa memakai index biasa[\s\S]*COLLATE NOCASE[\s\S]*PEKA huruf/,
    noTip: /tanpa WHERE/,
  },
  {
    label: 'COUNT(*) → scan seluruh covering index',
    sql: 'SELECT COUNT(*) FROM kunjungan;',
    tone: 'warn',
    nodes: [{ kind: 'index-scan', table: 'kunjungan', covering: true }],
    tip: /SCAN … USING INDEX tetap membaca seluruh entri index/,
  },
  {
    label: 'MAX() → ambil ujung index',
    sql: 'SELECT MAX(tgl_kunjungan) FROM kunjungan;',
    tone: 'good',
    nodes: [{ kind: 'index-search', table: 'kunjungan' }],
  },
  {
    label: 'ORDER BY tanpa index → temp b-tree',
    sql: 'SELECT * FROM pasien ORDER BY nama;',
    tone: 'warn',
    nodes: [{ kind: 'full-scan', table: 'pasien' }, { kind: 'temp-btree' }],
    tip: /Index pada kolom ORDER BY/,
  },
  {
    label: 'JOIN 3 tabel lewat FK ber-index → nested loop SEARCH',
    sql: 'SELECT k.no_rawat, p.nama, d.nama_dokter FROM kunjungan k JOIN pasien p ON p.no_rm = k.no_rm JOIN dokter d ON d.id_dokter = k.id_dokter;',
    tone: 'warn',
    nodes: [
      { kind: 'full-scan', table: 'kunjungan', innerLoop: false },
      { kind: 'index-search', table: 'pasien', innerLoop: true, tone: 'good' },
      { kind: 'index-search', table: 'dokter', innerLoop: true },
    ],
  },
  {
    label: 'CROSS JOIN → full scan berulang (bad)',
    sql: 'SELECT * FROM pasien CROSS JOIN poliklinik;',
    tone: 'bad',
    headline: /poliklinik dibaca seluruhnya berulang kali/,
    nodes: [
      { kind: 'full-scan', table: 'pasien', tone: 'warn', innerLoop: false },
      { kind: 'full-scan', table: 'poliklinik', tone: 'bad', innerLoop: true },
    ],
  },
  {
    label: 'JOIN tanpa index → AUTOMATIC INDEX + saran CREATE INDEX',
    sql: 'SELECT d.nama_dokter, COUNT(*) FROM dokter d JOIN kunjungan k ON k.id_poli = d.id_poli GROUP BY d.id_dokter;',
    tone: 'warn',
    nodes: [
      { kind: 'bloom-filter' },
      {
        kind: 'auto-index',
        table: 'kunjungan',
        suggestion: /^CREATE INDEX idx_kunjungan_id_poli ON kunjungan \(id_poli\);$/,
      },
    ],
  },
  {
    label: 'subquery berkorelasi dengan SCAN → bad + repeated',
    sql: 'SELECT pl.nama_poli, (SELECT COUNT(*) FROM dokter d WHERE d.id_poli = pl.id_poli) FROM poliklinik pl;',
    tone: 'bad',
    nodes: [
      { kind: 'full-scan', table: 'poliklinik', repeated: false },
      { kind: 'structure' },
      { kind: 'full-scan', table: 'dokter', tone: 'bad', repeated: true },
    ],
  },
  {
    label: 'subquery berkorelasi dengan SEARCH → tidak bad',
    sql: 'SELECT nama, (SELECT COUNT(*) FROM kunjungan k WHERE k.no_rm = p.no_rm) FROM pasien p;',
    tone: 'warn',
    nodes: [{ kind: 'index-search', table: 'kunjungan', repeated: true, tone: 'good' }],
  },
  {
    label: 'IN (subquery) → LIST SUBQUERY',
    sql: "SELECT * FROM pasien WHERE no_rm IN (SELECT no_rm FROM kunjungan WHERE status = 'Selesai');",
    tone: 'warn',
    nodes: [{ kind: 'index-search', table: 'pasien' }, { kind: 'structure' }, { kind: 'full-scan', table: 'kunjungan', innerLoop: false }],
  },
  {
    label: 'OR dua kolom ber-index → MULTI-INDEX OR',
    sql: "SELECT * FROM kunjungan WHERE no_rm = 'RM-0001' OR id_dokter = 'D01';",
    tone: 'good',
    nodes: [{ kind: 'structure' }, { kind: 'index-search', table: 'kunjungan' }],
    absent: ['full-scan'],
  },
  {
    label: 'CTE + window function → co-routine & derived scan',
    sql: 'WITH x AS (SELECT no_rm, ROW_NUMBER() OVER (PARTITION BY no_rm ORDER BY tgl_kunjungan) AS rn FROM kunjungan) SELECT * FROM x WHERE rn = 1;',
    tone: 'warn',
    nodes: [{ kind: 'structure' }, { kind: 'derived-scan' }],
  },
  {
    label: 'CTE rekursif murni → tidak membaca tabel',
    sql: 'WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM r WHERE n < 5) SELECT * FROM r;',
    tone: 'neutral',
    headline: /tidak membaca tabel fisik/,
    nodes: [{ kind: 'structure' }, { kind: 'derived-scan' }],
    absent: ['full-scan'],
  },
  {
    label: 'UNION ALL → compound query',
    sql: 'SELECT no_rm FROM pasien UNION ALL SELECT no_rm FROM kunjungan;',
    tone: 'warn',
    nodes: [{ kind: 'structure' }, { kind: 'index-scan', table: 'pasien' }, { kind: 'index-scan', table: 'kunjungan' }],
  },
  {
    label: 'FULL OUTER JOIN → RIGHT-JOIN step (scan sisa sekali, bukan nested loop)',
    sql: 'SELECT * FROM pasien p FULL OUTER JOIN kunjungan k ON k.no_rm = p.no_rm;',
    tone: 'warn',
    nodes: [
      { kind: 'index-search', table: 'kunjungan', innerLoop: true },
      { kind: 'structure' },
      { kind: 'full-scan', table: 'kunjungan', innerLoop: false, tone: 'warn' },
    ],
  },
  {
    label: 'self-join struktur_organisasi (dua alias satu tabel)',
    sql: 'SELECT b.nama_jabatan, a.nama_jabatan FROM struktur_organisasi b JOIN struktur_organisasi a ON a.id_jabatan = b.id_atasan;',
    tone: 'warn',
    nodes: [
      { kind: 'full-scan', table: 'struktur_organisasi' },
      { kind: 'index-search', table: 'struktur_organisasi', innerLoop: true },
    ],
  },
  {
    label: 'NOT IN (subquery) → cek keanggotaan lewat index (FOR IN-OPERATOR)',
    sql: 'SELECT nama FROM pasien WHERE no_rm NOT IN (SELECT no_rm FROM kunjungan);',
    tone: 'warn',
    nodes: [{ kind: 'full-scan', table: 'pasien' }, { kind: 'index-search', table: 'kunjungan', innerLoop: false }],
  },
  {
    label: 'MAX() pada kolom tanpa index → "SEARCH t" = full scan',
    sql: 'SELECT MAX(kode_icd10) FROM diagnosa;',
    tone: 'warn',
    headline: /Full table scan pada diagnosa/,
    nodes: [{ kind: 'full-scan', table: 'diagnosa', title: 'Full table scan (MIN/MAX)' }],
  },
  {
    label: 'MAX() berkorelasi tanpa index → full scan berulang (bad)',
    sql: 'SELECT * FROM pasien p WHERE p.kota = (SELECT MAX(d.kode_icd10) FROM diagnosa d WHERE d.nama_penyakit = p.nama);',
    tone: 'bad',
    nodes: [{ kind: 'full-scan', table: 'diagnosa', tone: 'bad', repeated: true }],
  },
  {
    label: 'alias sama untuk dua tabel di subquery berbeda → keduanya full scan',
    sql: "SELECT (SELECT COUNT(*) FROM kunjungan x WHERE x.status = 'Batal'), (SELECT COUNT(*) FROM diagnosa x WHERE x.jenis = 'Primer');",
    tone: 'warn',
    nodes: [{ kind: 'full-scan', table: 'kunjungan' }, { kind: 'full-scan', table: 'diagnosa' }],
  },
  {
    label: 'alias sama di cabang UNION ALL → tabel kedua tetap terdeteksi',
    sql: "SELECT x.nama FROM pasien x WHERE x.no_rm = 'RM-0001' UNION ALL SELECT x.nama_dokter FROM dokter x;",
    tone: 'warn',
    nodes: [{ kind: 'index-search', table: 'pasien' }, { kind: 'full-scan', table: 'dokter' }],
  },
  {
    label: 'alias luar dipakai lagi di subquery skalar (urutan teks ≠ urutan plan)',
    sql: "SELECT (SELECT COUNT(*) FROM kunjungan x WHERE x.status = 'Batal') AS n, x.nama FROM pasien x;",
    tone: 'warn',
    nodes: [{ kind: 'full-scan', table: 'pasien', repeated: false }, { kind: 'full-scan', table: 'kunjungan' }],
  },
  {
    label: 'nama tabel & alias ber-kutip',
    sql: `SELECT * FROM "kunjungan" "k" WHERE k.status = 'Batal';`,
    tone: 'warn',
    nodes: [{ kind: 'full-scan', table: 'kunjungan' }],
    absent: ['derived-scan'],
  },
  {
    label: 'alias ber-kurung siku',
    sql: "SELECT * FROM [pasien] [p] WHERE p.kota = 'Bandung';",
    tone: 'warn',
    nodes: [{ kind: 'full-scan', table: 'pasien' }],
    absent: ['derived-scan'],
  },
  {
    label: 'tabel di dalam VIEW (alias dari definisi view)',
    setup: "CREATE VIEW v_batal AS SELECT * FROM kunjungan kb WHERE status = 'Batal';",
    sql: 'SELECT * FROM v_batal v JOIN pasien p ON p.no_rm = v.no_rm;',
    tone: 'warn',
    nodes: [{ kind: 'full-scan', table: 'kunjungan' }],
    absent: ['derived-scan'],
  },
  {
    label: 'saran index meng-quote identifier & memakai nama yang belum ada',
    setup: 'CREATE TABLE t2 ("group" TEXT, nilai INT); CREATE INDEX idx_t2_group ON t2 (nilai); INSERT INTO t2 SELECT kota, 1 FROM pasien;',
    sql: 'SELECT * FROM pasien p JOIN t2 ON t2."group" = p.kota;',
    tone: 'warn',
    nodes: [{ kind: 'auto-index', table: 't2', suggestion: /^CREATE INDEX idx_t2_group_2 ON t2 \("group"\);$/ }],
  },
  {
    label: 'JOIN dengan COLLATE NOCASE → saran index yang tak terpakai dibuang',
    sql: 'SELECT * FROM kunjungan k JOIN pasien p ON p.kota = k.status COLLATE NOCASE;',
    tone: 'warn',
    nodes: [{ kind: 'auto-index' }],
    noSuggestion: true,
  },
  {
    label: 'agregat di SELECT bukan "kolom dibungkus fungsi"',
    sql: 'SELECT kota, COUNT(no_rm) FROM pasien GROUP BY kota;',
    tone: 'warn',
    nodes: [{ kind: 'full-scan', table: 'pasien' }],
    noTip: /dibungkus fungsi/,
  },
  {
    label: 'WITH … DELETE → cek FK bukan nested loop, tapi berulang per baris',
    sql: "WITH t AS (SELECT 'P01' AS r) DELETE FROM poliklinik WHERE id_poli IN (SELECT r FROM t);",
    tone: 'bad',
    nodes: [
      { kind: 'full-scan', table: 'kunjungan', fkCheck: true, innerLoop: false, tone: 'bad' },
      { kind: 'full-scan', table: 'dokter', fkCheck: true, innerLoop: false },
    ],
    tip: /pengecekan FOREIGN KEY otomatis/,
  },
  {
    label: 'DELETE tanpa WHERE di tabel induk → cek FK mahal + saran index FK',
    sql: 'DELETE FROM poliklinik;',
    tone: 'bad',
    headline: /pengecekan FOREIGN KEY/,
    nodes: [
      { kind: 'full-scan', table: 'kunjungan', fkCheck: true, tone: 'bad', suggestion: /^CREATE INDEX idx_kunjungan_id_poli ON kunjungan \(id_poli\);$/ },
      { kind: 'full-scan', table: 'dokter', fkCheck: true, suggestion: /^CREATE INDEX idx_dokter_id_poli ON dokter \(id_poli\);$/ },
    ],
    noTip: /tanpa WHERE memang/,
  },
  {
    label: 'DELETE dengan subquery (bukan FK) → tidak ada tip FOREIGN KEY',
    sql: "DELETE FROM billing WHERE no_rawat IN (SELECT no_rawat FROM kunjungan WHERE status = 'Batal');",
    tone: 'warn',
    nodes: [{ kind: 'full-scan', table: 'kunjungan', fkCheck: false }],
    noTip: /FOREIGN KEY/,
  },
  {
    label: 'INSERT … SELECT dengan CROSS JOIN → nested loop tetap terdeteksi',
    sql: 'INSERT INTO struktur_organisasi (id_jabatan, nama_jabatan, nama_pejabat) SELECT pl.id_poli || k.no_rawat, pl.nama_poli, k.status FROM poliklinik pl CROSS JOIN kunjungan k;',
    tone: 'bad',
    nodes: [{ kind: 'full-scan', table: 'kunjungan', innerLoop: true, tone: 'bad' }],
  },
  {
    label: 'scan seluruh index sebagai loop dalam → bad',
    sql: 'SELECT COUNT(*) FROM poliklinik pl CROSS JOIN kunjungan k;',
    tone: 'bad',
    nodes: [{ kind: 'index-scan', table: 'kunjungan', innerLoop: true, tone: 'bad' }],
  },
  {
    label: 'scan partial index → good',
    setup: "CREATE INDEX ib ON kunjungan (tgl_kunjungan) WHERE status = 'Batal';",
    sql: "SELECT * FROM kunjungan WHERE status = 'Batal';",
    tone: 'good',
    nodes: [{ kind: 'index-search', table: 'kunjungan', title: 'Scan partial index' }],
    absent: ['index-scan', 'full-scan'],
  },
  {
    label: 'LAST 2 TERMS OF ORDER BY → pengurutan sebagian',
    sql: 'SELECT * FROM kunjungan ORDER BY tgl_kunjungan, status, no_sep;',
    tone: 'warn',
    nodes: [{ kind: 'temp-btree', title: 'Pengurutan sebagian' }],
  },
  {
    label: 'LIMIT tanpa pengurutan → full scan bisa berhenti lebih awal',
    sql: 'SELECT * FROM pasien LIMIT 5;',
    tone: 'warn',
    headline: /berhenti lebih awal karena LIMIT/,
    nodes: [{ kind: 'full-scan', table: 'pasien', stopsEarly: true }],
    tip: /Ada LIMIT tanpa pengurutan/,
    noTip: /tanpa WHERE memang/,
  },
  {
    label: 'ORDER BY ber-index + LIMIT → baca index sesuai urutan (good)',
    sql: 'SELECT * FROM kunjungan ORDER BY tgl_kunjungan DESC LIMIT 3;',
    tone: 'good',
    nodes: [{ kind: 'index-scan', table: 'kunjungan', stopsEarly: true, tone: 'good' }],
    noTip: /SCAN … USING INDEX tetap membaca seluruh/,
  },
  {
    label: 'ORDER BY tanpa index + LIMIT → tidak berhenti lebih awal',
    sql: 'SELECT * FROM pasien ORDER BY nama LIMIT 3;',
    tone: 'warn',
    nodes: [{ kind: 'full-scan', table: 'pasien', stopsEarly: false }],
  },
  {
    label: 'UPDATE OR IGNORE bukan kondisi OR',
    sql: "UPDATE OR IGNORE billing SET status_bayar = 'Lunas';",
    tone: 'warn',
    nodes: [{ kind: 'full-scan', table: 'billing' }],
    noTip: /Kondisi OR/,
  },
  {
    label: 'nama saran index tidak bentrok dengan tabel/view bernama sama',
    setup: 'CREATE TABLE idx_kunjungan_id_poli (a);',
    sql: 'SELECT d.nama_dokter, COUNT(*) FROM dokter d JOIN kunjungan k ON k.id_poli = d.id_poli GROUP BY d.id_dokter;',
    tone: 'warn',
    nodes: [{ kind: 'auto-index', table: 'kunjungan', suggestion: /^CREATE INDEX idx_kunjungan_id_poli_2 ON kunjungan \(id_poli\);$/ }],
  },
  {
    label: 'cek FK tetap terdeteksi walau tabel anak disebut di subquery',
    sql: 'DELETE FROM poliklinik WHERE id_poli NOT IN (SELECT id_poli FROM dokter);',
    tone: 'bad',
    nodes: [{ kind: 'full-scan', table: 'dokter', fkCheck: true, innerLoop: false, suggestion: /^CREATE INDEX idx_dokter_id_poli ON dokter \(id_poli\);$/ }],
  },
  {
    label: 'cek FK ke tabel sendiri (struktur_organisasi.id_atasan)',
    sql: "DELETE FROM struktur_organisasi WHERE id_jabatan = 'J19';",
    tone: 'bad',
    nodes: [
      {
        kind: 'full-scan',
        table: 'struktur_organisasi',
        fkCheck: true,
        innerLoop: false,
        suggestion: /^CREATE INDEX idx_struktur_organisasi_id_atasan ON struktur_organisasi \(id_atasan\);$/,
      },
    ],
    tip: /pengecekan FOREIGN KEY otomatis/,
  },
  {
    label: 'alias di tabel turunan yang diratakan (flatten) tidak tertukar',
    sql: "SELECT * FROM (SELECT * FROM kunjungan t WHERE status = 'Batal') s JOIN dokter t ON t.nama_dokter = s.status;",
    tone: 'warn',
    nodes: [{ kind: 'full-scan', table: 'kunjungan' }, { kind: 'auto-index', table: 'dokter' }],
  },
  {
    label: 'loop EXISTS berhenti di baris pertama → langkah berikutnya bukan nested loop',
    sql: "SELECT * FROM dokter d WHERE EXISTS (SELECT 1 FROM kunjungan k WHERE k.status = 'Selesai');",
    tone: 'warn',
    nodes: [{ kind: 'full-scan', table: 'dokter', innerLoop: false, tone: 'warn' }],
  },
  {
    label: 'LIMIT + WHERE pada scan index → tidak diklaim berhenti lebih awal',
    sql: "SELECT * FROM kunjungan WHERE status = 'Tidak Ada' ORDER BY tgl_kunjungan LIMIT 3;",
    tone: 'warn',
    nodes: [{ kind: 'index-scan', table: 'kunjungan', stopsEarly: false, tone: 'warn' }],
    tip: /juga ada filter/,
  },
  {
    label: 'LIMIT -1 (tanpa batas) → tidak berhenti lebih awal',
    sql: 'SELECT * FROM pasien LIMIT -1;',
    tone: 'warn',
    nodes: [{ kind: 'full-scan', table: 'pasien', stopsEarly: false }],
  },
  {
    label: 'alias tabel bernama sama dengan CTE → tetap tabel',
    sql: "WITH k AS (SELECT 1 AS x) SELECT * FROM kunjungan k WHERE k.status = 'Batal';",
    tone: 'warn',
    nodes: [{ kind: 'full-scan', table: 'kunjungan' }],
  },
  {
    label: 'nama tabel berspasi dikenali (SELECT)',
    setup: 'CREATE TABLE "my tab" (y TEXT, pid TEXT REFERENCES pasien (no_rm));',
    sql: `SELECT * FROM "my tab" WHERE y = 'a';`,
    tone: 'warn',
    nodes: [{ kind: 'full-scan', table: 'my tab' }],
  },
  {
    label: 'nama tabel berspasi dikenali (cek FK)',
    setup: 'CREATE TABLE "my tab" (y TEXT, pid TEXT REFERENCES pasien (no_rm));',
    sql: "DELETE FROM pasien WHERE no_rm = 'RM-0001';",
    tone: 'bad',
    nodes: [{ kind: 'full-scan', table: 'my tab', fkCheck: true, tone: 'bad', suggestion: /^CREATE INDEX idx_my_tab_pid ON "my tab" \(pid\);$/ }],
  },
  {
    label: 'MIN/MAX tanpa index → tip MIN/MAX, bukan "wajar"',
    sql: 'SELECT MAX(status) FROM kunjungan;',
    tone: 'warn',
    nodes: [{ kind: 'full-scan', table: 'kunjungan' }],
    tip: /MIN\/MAX tanpa index membaca seluruh tabel/,
    noTip: /tanpa WHERE memang/,
  },
  {
    label: 'fungsi di kolom tabel LAIN tidak disalahkan untuk scan tabel ini',
    sql: "SELECT * FROM kunjungan k JOIN pasien p ON p.no_rm = k.no_rm WHERE substr(p.no_rm, 1, 2) = 'RM';",
    tone: 'warn',
    nodes: [{ kind: 'full-scan', table: 'kunjungan' }],
    noTip: /dibungkus fungsi/,
  },
  {
    label: 'ORDER BY hasil agregat → tidak menyarankan index ORDER BY',
    sql: 'SELECT pl.nama_poli, COUNT(k.no_rawat) AS jumlah_kunjungan FROM poliklinik pl LEFT JOIN kunjungan k ON k.id_poli = pl.id_poli GROUP BY pl.id_poli, pl.nama_poli ORDER BY jumlah_kunjungan DESC;',
    tone: 'warn',
    nodes: [{ kind: 'temp-btree' }],
    tip: /hasil hitungan/,
    noTip: /Index pada kolom ORDER BY/,
  },
  {
    label: 'MAX() pada INTEGER PRIMARY KEY → satu baris, bukan full scan',
    sql: 'SELECT MAX(id_diagnosa) FROM diagnosa;',
    tone: 'good',
    nodes: [{ kind: 'rowid-search', table: 'diagnosa', title: 'Ambil ujung PRIMARY KEY' }],
    absent: ['full-scan'],
    noTip: /MIN\/MAX tanpa index/,
  },
  {
    label: 'filter di dalam CTE + LIMIT → tidak diklaim berhenti lebih awal',
    sql: "WITH b AS (SELECT * FROM kunjungan WHERE status = 'Batal') SELECT * FROM b LIMIT 5;",
    tone: 'warn',
    nodes: [{ kind: 'full-scan', table: 'kunjungan', stopsEarly: false }],
    tip: /juga ada filter/,
  },
  {
    label: 'CTE bernama sama dengan alias tabel di dalamnya → SCAN hasil CTE',
    sql: 'WITH t AS (SELECT t.id_dokter, COUNT(*) AS jml FROM kunjungan t GROUP BY t.id_dokter) SELECT * FROM t WHERE jml > 2;',
    tone: 'warn',
    headline: /^(?!Full table scan)/,
    nodes: [{ kind: 'derived-scan', title: 'Baca hasil CTE' }, { kind: 'index-scan', table: 'kunjungan' }],
    absent: ['full-scan'],
  },
  {
    label: 'alias "d" dipakai tabel turunan (dokter) & JOIN (diagnosa) → tidak tertukar',
    sql: "SELECT x.nama_dokter, k.no_rawat, d.nama_penyakit FROM (SELECT * FROM dokter d WHERE d.spesialisasi = 'Bedah') x JOIN kunjungan k ON k.id_dokter = x.id_dokter JOIN diagnosa d ON d.no_rawat = k.no_rawat;",
    tone: 'warn',
    nodes: [{ kind: 'full-scan', table: 'diagnosa' }, { kind: 'index-search', table: 'dokter' }],
  },
  {
    label: 'alias "a" di badan CTE (pasien) & query utama (kunjungan) → tidak tertukar',
    sql: "WITH bpjs AS (SELECT * FROM pasien a WHERE penjamin = 'BPJS') SELECT * FROM kunjungan a JOIN bpjs ON a.no_rm = bpjs.no_rm;",
    tone: 'warn',
    nodes: [{ kind: 'full-scan', table: 'pasien' }, { kind: 'index-search', table: 'kunjungan' }],
  },
  {
    label: 'index sementara pada kolom yang hanya dimiliki satu tabel → tabel yang benar + saran',
    sql: "WITH bpjs AS (SELECT * FROM pasien a WHERE penjamin = 'BPJS') SELECT * FROM bpjs JOIN kunjungan a ON a.status = bpjs.kota;",
    tone: 'warn',
    nodes: [{ kind: 'auto-index', table: 'kunjungan', suggestion: /^CREATE INDEX idx_kunjungan_status ON kunjungan \(status\);$/ }],
  },
  {
    label: 'tabel TEMP ikut di salinan skema → saran index tetap ada',
    setup: "CREATE TEMP TABLE tmp_bdg AS SELECT * FROM pasien WHERE kota = 'Bandung';",
    sql: 'SELECT t.nama, k.no_rawat FROM tmp_bdg t JOIN kunjungan k ON k.status = t.kota;',
    tone: 'warn',
    nodes: [{ kind: 'auto-index', table: 'kunjungan', suggestion: /^CREATE INDEX idx_kunjungan_status ON kunjungan \(status\);$/ }],
  },
  {
    label: 'tabel bernama "sqlitedata" tidak tersaring dari salinan skema',
    setup: 'CREATE TABLE sqlitedata (id INTEGER, kode TEXT); INSERT INTO sqlitedata SELECT rowid, nama FROM pasien;',
    sql: 'SELECT * FROM pasien p JOIN sqlitedata s ON s.kode = p.kota;',
    tone: 'warn',
    nodes: [{ kind: 'auto-index', table: 'sqlitedata', suggestion: /^CREATE INDEX idx_sqlitedata_kode ON sqlitedata \(kode\);$/ }],
  },
  {
    label: 'ORDER BY alias agregat dari CTE → bukan saran index ORDER BY',
    sql: 'WITH t AS (SELECT id_dokter, COUNT(*) AS jml FROM kunjungan GROUP BY id_dokter) SELECT d.nama_dokter, t.jml FROM t JOIN dokter d ON d.id_dokter = t.id_dokter ORDER BY t.jml DESC, d.nama_dokter;',
    tone: 'warn',
    nodes: [{ kind: 'temp-btree' }],
    tip: /hasil hitungan/,
    noTip: /Index pada kolom ORDER BY/,
  },
  {
    label: 'DELETE → pengecekan FOREIGN KEY tidak dianggap nested loop',
    sql: "DELETE FROM pasien WHERE kota = 'Bandung';",
    tone: 'warn',
    nodes: [{ kind: 'full-scan', table: 'pasien' }, { kind: 'index-search', table: 'kunjungan', innerLoop: false, fkCheck: true }],
    tip: /pengecekan FOREIGN KEY/,
  },
];

function fresh(SQL: SqlJsStatic): Database {
  return createSeededDatabase(SQL);
}

function matchesNode(node: PlanNode, expected: NodeExpectation): boolean {
  if (node.kind !== expected.kind) return false;
  if (expected.table !== undefined && node.table !== expected.table) return false;
  if (expected.tone !== undefined && node.tone !== expected.tone) return false;
  if (expected.innerLoop !== undefined && node.innerLoop !== expected.innerLoop) return false;
  if (expected.repeated !== undefined && node.repeated !== expected.repeated) return false;
  if (expected.covering !== undefined && node.covering !== expected.covering) return false;
  if (expected.fkCheck !== undefined && node.fkCheck !== expected.fkCheck) return false;
  if (expected.stopsEarly !== undefined && node.stopsEarly !== expected.stopsEarly) return false;
  if (expected.title !== undefined && node.title !== expected.title) return false;
  if (expected.suggestion !== undefined && !(node.suggestion !== null && expected.suggestion.test(node.suggestion))) return false;
  return true;
}

function singlePlan(report: PlanReport, label: string): PlanStatement | null {
  if (!report.ok) {
    fail(`plan "${label}": explain gagal — ${report.rawError}`);
    return null;
  }
  const [first] = report.statements;
  if (report.statements.length !== 1 || first?.status !== 'plan') {
    fail(`plan "${label}": diharapkan 1 statement ber-plan, dapat ${report.statements.map((s) => s.status).join(', ')}`);
    return null;
  }
  return first;
}

function describeNodes(nodes: readonly PlanNode[]): string {
  return nodes.map((n) => `${n.kind}/${n.tone}/${n.table ?? '-'}${n.innerLoop ? '/loop' : ''}${n.repeated ? '/rep' : ''}`).join(' · ');
}

function verifyPlanCase(SQL: SqlJsStatic, db: Database, testCase: PlanCase): void {
  const statement = singlePlan(explainScript(db, testCase.sql, SQL), testCase.label);
  if (!statement) return;
  const nodes = flattenPlan(statement.roots);
  const { summary } = statement;
  const where = `plan "${testCase.label}"`;

  assert(summary.tone === testCase.tone, `${where}: tone ringkasan ${summary.tone}, diharapkan ${testCase.tone}`);
  if (testCase.headline) assert(testCase.headline.test(summary.headline), `${where}: headline "${summary.headline}"`);
  for (const expected of testCase.nodes) {
    assert(nodes.some((n) => matchesNode(n, expected)), `${where}: tidak ada langkah ${JSON.stringify(expected)} — dapat ${describeNodes(nodes)}`);
  }
  for (const kind of testCase.absent ?? []) {
    assert(!nodes.some((n) => n.kind === kind), `${where}: langkah ${kind} seharusnya tidak ada — dapat ${describeNodes(nodes)}`);
  }
  if (testCase.tip) assert(summary.tips.some((t) => testCase.tip?.test(t) ?? false), `${where}: tip ${testCase.tip} tidak ditemukan`);
  if (testCase.noTip) assert(!summary.tips.some((t) => testCase.noTip?.test(t) ?? false), `${where}: tip ${testCase.noTip} seharusnya tidak ada`);
  assert(!nodes.some((n) => n.kind === 'other'), `${where}: ada langkah tak dikenali — ${describeNodes(nodes)}`);
  if (testCase.noSuggestion) assert(!nodes.some((n) => n.suggestion !== null), `${where}: seharusnya tidak ada saran index`);
}

/* ------------------------------------------------------------------ */
/* Skrip multi-statement & kegagalan                                   */
/* ------------------------------------------------------------------ */

interface DbFingerprint {
  changes: number;
  schema: number;
  counts: string;
}

function fingerprint(db: Database): DbFingerprint {
  const tables = db.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND substr(name, 1, 7) <> 'sqlite_' ORDER BY name")[0]?.values ?? [];
  const counts = tables
    .map(([name]) => `${String(name)}=${String(db.exec(`SELECT COUNT(*) FROM "${String(name)}"`)[0]?.values[0]?.[0] ?? '?')}`)
    .join(',');
  return { changes: getTotalChanges(db), schema: getSchemaVersion(db), counts };
}

function sameFingerprint(a: DbFingerprint, b: DbFingerprint): boolean {
  return a.changes === b.changes && a.schema === b.schema && a.counts === b.counts;
}

function verifyScripts(SQL: SqlJsStatic, db: Database): void {
  const empty = explainScript(db, '  -- hanya komentar\n ; ', SQL);
  assert(!empty.ok, 'explain: SQL kosong harus ditolak');

  const pragma = explainScript(db, 'PRAGMA foreign_keys = OFF;', SQL);
  assert(!pragma.ok, 'explain: skrip ber-PRAGMA harus ditolak');
  const fk = db.exec('PRAGMA foreign_keys')[0]?.values[0]?.[0];
  assert(fk === 1, 'explain: PRAGMA tidak boleh berlaku setelah Explain');

  const before = fingerprint(db);
  const script = [
    '-- komentar di depan',
    "EXPLAIN QUERY PLAN SELECT * FROM pasien WHERE kota = 'Bandung';",
    'BEGIN;',
    "UPDATE billing SET status_bayar = 'Lunas';",
    "DELETE FROM pasien WHERE kota = 'Bandung';",
    "INSERT INTO poliklinik VALUES ('P99', 'Poli Uji', 'Gedung Z');",
    'CREATE INDEX idx_uji ON pasien (kota);',
    'DROP TABLE billing;',
    'COMMIT;',
  ].join('\n');
  const report = explainScript(db, script, SQL);
  assert(sameFingerprint(before, fingerprint(db)), 'explain: skrip DML/DDL/transaksi tidak boleh mengubah database');
  assert(db.exec("SELECT name FROM sqlite_master WHERE name = 'idx_uji'").length === 0, 'explain: CREATE INDEX tidak boleh dijalankan');
  if (!report.ok) {
    fail(`explain skrip campuran gagal: ${report.rawError}`);
  } else {
    const statuses = report.statements.map((s) => s.status).join(',');
    assert(
      statuses === 'plan,no-plan,plan,plan,no-plan,no-plan,no-plan,no-plan',
      `explain skrip campuran: status ${statuses}`,
    );
    assert(report.statements[0]?.sql.startsWith('SELECT') ?? false, 'explain: awalan komentar + EXPLAIN QUERY PLAN harus dibuang dari statement');
    assert(!report.stoppedAtError && report.omittedCount === 0, 'explain skrip campuran: tidak boleh berhenti/terpotong');
  }

  const broken = explainScript(db, 'SELECT 1; SELECT * FROM tabel_tidak_ada; SELECT 2;', SQL);
  if (!broken.ok) {
    fail('explain: skrip dengan statement gagal harus tetap ok=true dengan status error');
  } else {
    const statuses = broken.statements.map((s) => s.status).join(',');
    assert(statuses === 'plan,error' && broken.stoppedAtError, `explain: skrip rusak → plan,error + stoppedAtError (dapat ${statuses})`);
  }

  const many = Array.from({ length: 25 }, (_, i) => `SELECT ${i};`).join('\n');
  const capped = explainScript(db, many, SQL);
  assert(capped.ok && capped.statements.length === 20 && capped.omittedCount === 5, 'explain: batas 20 statement + omittedCount');

  const doubleSemicolon = explainScript(db, 'SELECT * FROM pasien;; ; -- kosong\n; SELECT * FROM dokter', SQL);
  assert(
    doubleSemicolon.ok && doubleSemicolon.statements.map((s) => s.status).join(',') === 'plan,plan',
    'explain: statement kosong (;;) tidak boleh membuat statement berikutnya error',
  );

  const errorLate = explainScript(db, `${Array.from({ length: 22 }, (_, i) => `SELECT ${i};`).join(' ')} SELECT * FROM tidak_ada; SELECT 1;`, SQL);
  assert(errorLate.ok && errorLate.errorAfterLimit && !errorLate.stoppedAtError, 'explain: error setelah batas 20 statement harus dilaporkan (errorAfterLimit)');

  const ddlScript = explainScript(db, "SELECT * FROM pasien WHERE nama = 'x'; CREATE INDEX idx_tmp ON pasien (nama); SELECT * FROM pasien WHERE nama = 'x';", SQL);
  const ddlFlags = ddlScript.ok ? ddlScript.statements.map((s) => (s.status === 'plan' ? String(s.afterUnappliedDdl) : s.status)).join(',') : '';
  assert(ddlFlags === 'false,no-plan,true', `explain: plan setelah CREATE INDEX yang belum dijalankan harus ditandai (dapat ${ddlFlags})`);

  const applied = createSeededDatabase(SQL);
  try {
    applied.exec('CREATE INDEX idx_pasien_nama ON pasien (nama);');
    const rerun = explainScript(applied, "CREATE INDEX IF NOT EXISTS idx_pasien_nama ON pasien (nama); SELECT * FROM pasien WHERE nama = 'x';", SQL);
    const second = rerun.ok ? rerun.statements[1] : undefined;
    assert(
      second?.status === 'plan' && !second.afterUnappliedDdl,
      'explain: DDL yang sudah diterapkan (IF NOT EXISTS) tidak boleh memunculkan catatan "klik Run dulu"',
    );
  } finally {
    applied.close();
  }

  const ddlFlag = (setup: string, script: string, at: number): string => {
    const scratch = createSeededDatabase(SQL);
    try {
      if (setup) scratch.exec(setup);
      const report = explainScript(scratch, script, SQL);
      const statement = report.ok ? report.statements[at] : undefined;
      return statement?.status === 'plan' ? String(statement.afterUnappliedDdl) : (statement?.status ?? 'none');
    } finally {
      scratch.close();
    }
  };
  assert(
    ddlFlag("CREATE TEMP TABLE tmp_bdg AS SELECT * FROM pasien WHERE kota = 'Bandung';", "CREATE INDEX idx_tmp_kota ON tmp_bdg (kota); SELECT * FROM tmp_bdg WHERE kota = 'Bandung';", 1) === 'true',
    'explain: DDL pada tabel TEMP yang belum dijalankan harus ditandai',
  );
  assert(
    ddlFlag('CREATE VIRTUAL TABLE dok USING fts4(isi);', "CREATE INDEX IF NOT EXISTS idx_kunjungan_no_rm ON kunjungan (no_rm); SELECT * FROM pasien WHERE nama = 'a';", 1) === 'false',
    'explain: virtual table FTS4 tidak boleh merusak salinan skema (IF NOT EXISTS yang sudah ada → tanpa catatan)',
  );
  const started = performance.now();
  const ctasFlag = ddlFlag('', 'CREATE TABLE angka AS WITH RECURSIVE c(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM c) SELECT n FROM c; SELECT * FROM pasien;', 1);
  assert(ctasFlag === 'true' && performance.now() - started < 2000, `explain: CREATE TABLE … AS dengan CTE tanpa batas tidak boleh dijalankan (dapat ${ctasFlag})`);

  const semicolonInString = explainScript(db, "SELECT 'a;b' AS x; SELECT 2;", SQL);
  assert(semicolonInString.ok && semicolonInString.statements.length === 2, 'explain: titik koma di dalam string bukan pemisah statement');
}

/* ------------------------------------------------------------------ */
/* Sapuan korpus kurikulum                                             */
/* ------------------------------------------------------------------ */

function corpus(): Array<{ label: string; sql: string }> {
  const items: Array<{ label: string; sql: string }> = [];
  for (const mission of MISSIONS) {
    if (mission.kind !== 'sql') continue;
    items.push({ label: `${mission.id}/solusi`, sql: mission.solutionSql });
    const cases = MISSION_TEST_CASES[mission.id];
    for (const c of [...(cases?.wrong ?? []), ...(cases?.correct ?? [])]) items.push({ label: `${mission.id}/${c.label}`, sql: c.answer });
  }
  return items;
}

function verifyCorpus(SQL: SqlJsStatic): number {
  const db = fresh(SQL);
  let plans = 0;
  try {
    const before = fingerprint(db);
    for (const item of corpus()) {
      explainScript(db, item.sql); // jalur cadangan (tanpa salinan skema) juga tidak boleh mengubah DB
      const report = explainScript(db, item.sql, SQL);
      if (!report.ok) continue; // SQL kosong — bagian dari kasus uji "jawaban salah"
      for (const statement of report.statements) {
        if (statement.status !== 'plan') continue;
        plans += 1;
        const unknown = flattenPlan(statement.roots).filter((n) => n.kind === 'other');
        assert(unknown.length === 0, `korpus ${item.label}: langkah tak dikenali — ${unknown.map((n) => n.detail).join(' | ')}`);
        assert(statement.summary.headline.length > 0, `korpus ${item.label}: headline kosong`);
      }
    }
    assert(sameFingerprint(before, fingerprint(db)), 'korpus: Explain atas seluruh jawaban kurikulum tidak boleh mengubah database');
  } finally {
    db.close();
  }
  return plans;
}

function verifyCases(SQL: SqlJsStatic): void {
  const shared = fresh(SQL);
  try {
    const before = fingerprint(shared);
    for (const testCase of PLAN_CASES) {
      if (!testCase.setup) {
        verifyPlanCase(SQL, shared, testCase);
        continue;
      }
      const db = fresh(SQL);
      try {
        db.exec(testCase.setup);
        verifyPlanCase(SQL, db, testCase);
      } finally {
        db.close();
      }
    }
    assert(sameFingerprint(before, fingerprint(shared)), 'kasus plan: Explain (termasuk uji coba saran index) tidak boleh mengubah database');
  } finally {
    shared.close();
  }
}

/** Saran index diuji dalam SAVEPOINT: transaksi user tetap terbuka & utuh; saran yang diterapkan benar-benar mengubah plan. */
function verifySuggestions(SQL: SqlJsStatic): void {
  const db = fresh(SQL);
  try {
    const query = 'SELECT d.nama_dokter, COUNT(*) FROM dokter d JOIN kunjungan k ON k.id_poli = d.id_poli GROUP BY d.id_dokter;';
    db.exec("BEGIN; UPDATE billing SET status_bayar = 'Lunas';");
    const inTx = explainScript(db, query);
    const lunas = db.exec("SELECT COUNT(*) FROM billing WHERE status_bayar <> 'Lunas'")[0]?.values[0]?.[0];
    assert(lunas === 0, 'saran index: perubahan di transaksi user yang masih terbuka tidak boleh hilang');
    let stillOpen = true;
    try {
      db.exec('BEGIN');
      stillOpen = false;
    } catch {
      stillOpen = true;
    }
    assert(stillOpen, 'saran index: transaksi user harus tetap terbuka setelah Explain');
    db.exec('ROLLBACK');

    const statement = inTx.ok ? inTx.statements[0] : undefined;
    const suggestion = statement?.status === 'plan' ? flattenPlan(statement.roots).find((n) => n.suggestion)?.suggestion : undefined;
    if (!suggestion) {
      fail('saran index: query JOIN tanpa index harus punya saran');
      return;
    }
    db.exec(suggestion);
    const after = explainScript(db, query);
    const afterPlan = after.ok ? after.statements[0] : undefined;
    const nodes = afterPlan?.status === 'plan' ? flattenPlan(afterPlan.roots) : [];
    assert(
      nodes.some((n) => n.kind === 'index-search' && n.table === 'kunjungan') && !nodes.some((n) => n.kind === 'auto-index'),
      `saran index: setelah diterapkan, plan harus SEARCH lewat index baru — dapat ${describeNodes(nodes)}`,
    );
  } finally {
    db.close();
  }
}

export function verifyPlanTree(SQL: SqlJsStatic): void {
  verifyCases(SQL);
  verifySuggestions(SQL);
  const db = fresh(SQL);
  try {
    verifyScripts(SQL, db);
  } finally {
    db.close();
  }
  const plans = verifyCorpus(SQL);
  console.log(`  ${PLAN_CASES.length} kasus plan tertarget, skrip campuran tanpa efek samping, ${plans} plan dari korpus kurikulum ✓`);
}
