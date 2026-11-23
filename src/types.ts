/**
 * Kontrak tipe bersama untuk seluruh aplikasi.
 * Semua modul (lib, hooks, components, data) WAJIB memakai tipe dari sini
 * agar antarmuka antar-modul tetap konsisten.
 */

/* ------------------------------------------------------------------ */
/* Database / hasil query                                              */
/* ------------------------------------------------------------------ */

/** Nilai satu sel hasil query (setara SqlValue milik sql.js). */
export type CellValue = string | number | null | Uint8Array;

/** Satu result set (satu statement SELECT). */
export interface QueryResult {
  columns: string[];
  rows: CellValue[][];
}

/** Hasil eksekusi SQL yang sukses. `results` bisa kosong (mis. statement UPDATE). */
export interface ExecSuccess {
  ok: true;
  results: QueryResult[];
  /** true jika SQL mengandung INSERT/UPDATE/DELETE/DROP/ALTER/CREATE/REPLACE. */
  mutated: boolean;
  /** Jumlah baris yang berubah (db.getRowsModified()) — 0 untuk SELECT murni. */
  rowsModified: number;
  elapsedMs: number;
  /**
   * Teks SQL statement yang menghasilkan result set TERAKHIR (via stmt.getSQL()),
   * null jika tidak ada result set. Dipakai untuk EXPLAIN QUERY PLAN pada penilaian.
   */
  lastResultSql: string | null;
}

/** Hasil eksekusi SQL yang gagal (syntax error, tabel tidak ada, dll.). */
export interface ExecFailure {
  ok: false;
  /** Pesan asli dari SQLite, mis. `near "SELEC": syntax error`. */
  rawError: string;
  /** Penjelasan ramah berbahasa Indonesia + saran perbaikan. */
  friendlyError: string;
}

export type ExecOutcome = ExecSuccess | ExecFailure;

/** Metadata kolom untuk Schema Explorer. */
export interface ColumnInfo {
  name: string;
  type: string;
  notNull: boolean;
  isPrimaryKey: boolean;
  /** Terisi jika kolom ini foreign key. */
  foreignKey: { table: string; column: string } | null;
}

/** Metadata index untuk Schema Explorer (dari PRAGMA index_list + index_info). */
export interface IndexInfo {
  name: string;
  columns: string[];
  unique: boolean;
  /** 'pk' = dibuat otomatis untuk PRIMARY KEY, 'u' = otomatis untuk UNIQUE, 'c' = CREATE INDEX eksplisit. */
  origin: 'pk' | 'u' | 'c';
  /** true untuk partial index (CREATE INDEX ... WHERE ...): hanya mencakup sebagian baris. */
  partial: boolean;
}

export interface TableInfo {
  name: string;
  /** Deskripsi singkat berbahasa Indonesia (dari TABLE_DESCRIPTIONS). */
  description: string;
  columns: ColumnInfo[];
  indexes: IndexInfo[];
  rowCount: number;
}

/* ------------------------------------------------------------------ */
/* Misi / kurikulum                                                    */
/* ------------------------------------------------------------------ */

export type Tier = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/** Field yang dimiliki SEMUA jenis misi. */
export interface MissionBase {
  /** ID unik & stabil, mis. "t1-select". Dipakai sebagai key di localStorage. */
  id: string;
  tier: Tier;
  /** Nomor urut global 1..N (kontigu). */
  order: number;
  title: string;
  /** Konsep yang dilatih, mis. "SELECT", "LEFT JOIN", "Window Function", "SQL Injection". */
  concept: string;
  /** Konteks skenario rumah sakit (1–3 kalimat). */
  story: string;
  /** Instruksi jelas tentang apa yang harus dicapai. */
  task: string;
  /** Petunjuk bertahap: dari umum → sangat spesifik (2–3 langkah). */
  hint: string[];
  xpReward: number;
}

/**
 * Konstruksi SQL yang WAJIB dipakai user (mis. CTE, OVER, BEGIN/COMMIT).
 * Dicocokkan pada SQL user setelah komentar & string literal dibuang.
 */
export interface RequiredPattern {
  /** Sumber regex (dikompilasi dengan flag 'i'), mis. "\\bOVER\\s*\\(". */
  pattern: string;
  /** Pesan ramah jika tidak ditemukan, mis. "Misi ini wajib memakai window function (… OVER (…))." */
  message: string;
}

/** Cara menilai misi SQL. Jika `grading` tidak diisi → { type: 'result' }. */
export type SqlGrading =
  /** Bandingkan result set terakhir user dengan result set solutionSql. */
  | {
      type: 'result';
      /**
       * Opsional: setelah hasil benar, query plan (EXPLAIN QUERY PLAN) statement terakhir user
       * WAJIB melakukan SEARCH pada `table` lewat index yang kolom PERTAMA-nya `column`, dengan
       * kesamaan (`col=?`) atau rentang dua sisi (`col>? AND col<?`), tanpa full SCAN pada tabel itu,
       * dan kolom itu tidak boleh dibungkus fungsi di SQL user. Untuk misi query sargable.
       */
      requireIndexOn?: { table: string; column: string };
    }
  /**
   * Untuk DML/TCL: jalankan solutionSql di DB segar A dan SQL user di DB segar B,
   * lalu bandingkan hasil `verifySql` (SELECT pembaca kondisi akhir) di A vs B.
   * Transaksi yang dibiarkan terbuka (BEGIN tanpa COMMIT/ROLLBACK) dianggap salah.
   */
  | {
      type: 'state';
      verifySql: string;
      /** Label tampilan hasil verifySql, mis. "Isi tabel billing setelah query". */
      label: string;
      /**
       * Opsional, untuk misi transaksi: SQL user dilacak per statement. Setiap statement yang
       * mengubah data wajib berjalan di dalam transaksi (bukan autocommit). Jika
       * `requireRolledBackChange`, harus ada ROLLBACK yang benar-benar membatalkan ≥1 perubahan.
       */
      transaction?: { requireRolledBackChange: boolean };
    }
  /**
   * Untuk CREATE INDEX: setelah SQL user, harus ada index di `table` dengan kolom pertama `column`,
   * dan EXPLAIN QUERY PLAN `probeSql` harus memakai index milik `table`.
   */
  | {
      type: 'index';
      table: string;
      column: string;
      probeSql: string;
    }
  /**
   * Untuk DDL (Tier 9): solutionSql di DB segar A, SQL user di DB segar B, lalu berurutan:
   * (1) setiap objek di `objects` harus ada dengan jenis yang benar; struktur tabel (kolom, afinitas tipe, NOT NULL,
   *     PRIMARY KEY, FOREIGN KEY, UNIQUE) harus sama dengan hasil solusi;
   * (2) setiap `probes` dijalankan berurutan di A dan B dan harus sama-sama diterima/ditolak — CHECK, DEFAULT, dan isi
   *     trigger dinilai dari perilakunya, bukan dari teksnya;
   * (3) hasil `verifySql` (setelah probe) dibandingkan, plus isi semua tabel seed (kerusakan kolateral).
   */
  | {
      type: 'schema';
      objects: Array<{ name: string; type: SchemaObjectType }>;
      probes: SchemaProbe[];
      verifySql: string;
      /** Label tampilan hasil verifySql, mis. "Isi tabel jadwal_praktik setelah uji". */
      label: string;
    };

export type SchemaObjectType = 'table' | 'view' | 'trigger';

export interface SchemaProbe {
  /** Satu statement (biasanya INSERT/UPDATE/DELETE) yang dijalankan setelah SQL user. */
  sql: string;
  /** Untuk pesan & tabel uji, mis. "Jadwal dengan kuota 0" — hasil yang diharapkan diambil dari DB solusi. */
  description: string;
}

export interface SqlMission extends MissionBase {
  kind: 'sql';
  /** Query referensi; hasilnya (atau hasil verifySql setelahnya) dijadikan "Expected Output". */
  solutionSql: string;
  /** Query awal yang diisikan ke editor saat misi dibuka. */
  starterSql: string;
  /**
   * true jika urutan baris ikut dinilai (soal yang meminta ORDER BY).
   * false → baris dibandingkan sebagai multiset (urutan diabaikan).
   * Untuk grading 'state', berlaku pada hasil verifySql.
   */
  orderMatters: boolean;
  grading?: SqlGrading;
  requiredPatterns?: RequiredPattern[];
  /**
   * Diisi untuk misi "Perbaiki Query": `starterSql` berisi query BERMASALAH yang harus diperbaiki
   * (bukan ditulis dari nol). Penilaian tetap sama (dibandingkan dengan solutionSql); verifikasi
   * memastikan starterSql sendiri dinilai salah.
   */
  fix?: {
    /** Jumlah bug yang sengaja ditanam di starterSql (ditampilkan ke user). */
    bugCount: number;
  };
  /**
   * Diisi untuk Boss Challenge: soal gabungan di akhir tier, tanpa hint (`hint` kosong), tanpa materi khusus,
   * dan solusi baru bisa dibuka setelah beberapa percobaan (lihat src/lib/boss.ts). Terbuka setelah semua misi
   * lain di tier-nya selesai, dan tidak mengunci tier berikutnya.
   */
  boss?: BossInfo;
}

export interface BossInfo {
  /** ID misi (tier yang sama atau sebelumnya) yang konsepnya digabung; ditampilkan sebagai rekap, bukan petunjuk langkah. */
  combines: string[];
}

/** Target yang harus dicapai penyerang di lab SQL injection. */
export type InjectionGoal =
  | { type: 'row-count-at-least'; count: number; description: string }
  | { type: 'contains-value'; value: string | number; description: string }
  /**
   * Setiap nilai kolom pertama `referenceSql` (dijalankan di DB seed segar) harus muncul di sel mana pun
   * pada data yang tampil, mis. semua no_rm dari `SELECT no_rm FROM pasien`.
   */
  | { type: 'contains-all-values'; referenceSql: string; description: string };

export interface InjectionLab {
  /** Judul form simulasi, mis. "Portal Cek Data Pasien". */
  formTitle: string;
  inputLabel: string;
  placeholder: string;
  /** Template SQL RENTAN; setiap `{input}` diganti mentah-mentah dengan input user (string concatenation). */
  vulnerableTemplate: string;
  /** Versi AMAN dengan tepat satu placeholder `?`; input di-bind sebagai parameter (prepared statement). */
  safeTemplate: string;
  /** Contoh input normal, mis. "RM-0001". */
  sampleInput: string;
  goal: InjectionGoal;
  /**
   * Opsional: konstruksi yang wajib ada pada SQL rentan hasil penyambungan (setelah komentar &
   * string literal dibuang), mis. `\bFROM\s+billing\b` agar nilai target benar-benar dibaca dari tabel,
   * bukan diketik sebagai literal. Hanya dinilai di mode rentan.
   */
  requiredPatterns?: RequiredPattern[];
}

/** Misi lab keamanan: user mengetik INPUT FORM (bukan SQL) yang disisipkan ke template rentan. */
export interface InjectionMission extends MissionBase {
  kind: 'injection';
  lab: InjectionLab;
  /** Contoh payload yang berhasil (ditampilkan saat "Show Solution"). */
  solutionPayload: string;
}

export interface CodeExample {
  /** Mis. "T-SQL (SQL Server)", "PL/pgSQL (PostgreSQL)", "MySQL", "Node.js (sql.js)". */
  dialect: string;
  code: string;
  caption?: string;
}

export interface ConceptSection {
  heading: string;
  /** Paragraf penjelasan; pisahkan paragraf dengan "\n\n". Boleh memakai `kode` dalam backtick. */
  body: string;
  examples?: CodeExample[];
}

export interface QuizQuestion {
  /** ID unik dalam misi, mis. "q1". */
  id: string;
  question: string;
  options: string[];
  /** Indeks 0-based opsi yang benar. */
  correctIndex: number;
  /** Penjelasan yang ditampilkan setelah dijawab. */
  explanation: string;
}

/** Kartu materi konsep (tanpa eksekusi SQL) + kuis pilihan ganda yang dinilai otomatis. */
export interface ConceptMission extends MissionBase {
  kind: 'concept';
  sections: ConceptSection[];
  quiz: QuizQuestion[];
}

/** Satu pilihan pengecoh pada misi "Tebak Hasil". */
export interface PredictDistractor {
  /**
   * SELECT yang hasilnya mewakili salah paham umum (mis. query yang sama tanpa tanda kurung).
   * Hasilnya ditampilkan sebagai pilihan jawaban; SQL-nya baru diperlihatkan setelah dijawab.
   */
  sql: string;
  /** Salah paham yang diwakili pilihan ini, mis. "Mengira OR dievaluasi lebih dulu daripada AND." */
  misconception: string;
}

/**
 * Misi "Tebak Hasil": user membaca `query` (read-only), lalu memilih tabel hasil yang benar di antara
 * hasil query itu sendiri dan hasil setiap pengecoh. Semua tabel dihitung saat runtime di DB seed,
 * sehingga kunci jawaban selalu benar.
 */
export interface PredictMission extends MissionBase {
  kind: 'predict';
  /** SELECT yang hasilnya harus ditebak. */
  query: string;
  /** Penjelasan mengapa hasilnya demikian (ditampilkan setelah benar / solusi dibuka). */
  explanation: string;
  /** 2–3 pengecoh; hasilnya harus berbeda dari hasil `query` dan satu sama lain. */
  distractors: PredictDistractor[];
  /** true jika urutan baris bagian dari jawaban (query memakai ORDER BY). */
  orderMatters: boolean;
}

export type Mission = SqlMission | InjectionMission | ConceptMission | PredictMission;

export interface TierInfo {
  tier: Tier;
  name: string;
  description: string;
}

/* ------------------------------------------------------------------ */
/* Validasi jawaban                                                    */
/* ------------------------------------------------------------------ */

export type MismatchReason =
  | 'no-result'        // query user tidak menghasilkan result set (mis. hanya UPDATE)
  | 'column-count'
  | 'column-names'
  | 'row-count'
  | 'cell-values'
  | 'row-order'
  | 'missing-construct'  // requiredPatterns tidak terpenuhi
  | 'open-transaction'   // BEGIN tanpa COMMIT/ROLLBACK (misi 'state')
  | 'transaction-flow'   // misi transaksi: ada perubahan di luar transaksi / ROLLBACK tidak membatalkan apa pun
  | 'index-missing'      // misi 'index': index yang diminta belum ada
  | 'plan-scan'          // query plan masih full SCAN, tidak memakai index
  | 'goal-not-met'       // lab injection: target serangan belum tercapai
  | 'quiz-wrong'         // misi konsep: ada jawaban kuis yang salah
  | 'predict-wrong'      // misi tebak hasil: pilihan tabel salah
  | 'schema-object'      // misi DDL: tabel/view/trigger yang diminta belum ada atau jenisnya salah
  | 'schema-structure'   // misi DDL: kolom/tipe/NOT NULL/PK/FK/UNIQUE berbeda
  | 'probe-mismatch';    // misi DDL: uji perilaku diterima/ditolak tidak sesuai

export interface CompareOutcome {
  match: boolean;
  /** null jika match. */
  reason: MismatchReason | null;
  /** Penjelasan ramah berbahasa Indonesia tentang perbedaannya. */
  message: string;
  /** Lokasi sel pertama yang berbeda (untuk highlight di tabel), jika ada. */
  firstDiff: { row: number; column: number } | null;
}

/** Label tampilan untuk tabel actual/expected (default: "Hasil Kamu" / "Expected Output"). */
export interface CheckView {
  actualLabel: string;
  expectedLabel: string;
  /** Catatan tambahan, mis. ringkasan query plan atau "Penilaian berdasarkan isi tabel billing". */
  note?: string;
}

export type CheckResult =
  | { kind: 'error'; rawError: string; friendlyError: string }
  | {
      kind: 'wrong';
      actual: QueryResult | null;
      /** null jika tidak ada pembanding tabel (mis. lab injection, kuis). */
      expected: QueryResult | null;
      compare: CompareOutcome;
      elapsedMs: number;
      view?: CheckView;
    }
  | {
      kind: 'correct';
      actual: QueryResult;
      expected: QueryResult | null;
      elapsedMs: number;
      view?: CheckView;
    };

/** Hasil satu kali menjalankan lab injection. */
export interface InjectionRun {
  /** SQL yang benar-benar dieksekusi server (template + input, atau template aman + keterangan bind). */
  executedSql: string;
  safeMode: boolean;
  outcome: ExecOutcome;
  /** true hanya jika mode rentan & target serangan tercapai. */
  goalMet: boolean;
  check: CheckResult;
}

export interface QuizResult {
  correct: boolean;
  /** ID pertanyaan yang dijawab salah / belum dijawab. */
  wrongIds: string[];
}

/* ------------------------------------------------------------------ */
/* Progres & gamifikasi                                                */
/* ------------------------------------------------------------------ */

export interface MissionProgress {
  completed: boolean;
  /** XP yang benar-benar didapat saat misi diselesaikan pertama kali. */
  earnedXp: number;
  /** true jika user pernah membuka hint untuk misi ini (penalti 20%). */
  hintUsed: boolean;
  /** Berapa langkah hint yang sudah dibuka (0..hint.length). */
  hintsRevealed: number;
  /** true jika user pernah membuka solusi (XP = 0). */
  solutionShown: boolean;
  attempts: number;
  /** ISO timestamp saat pertama kali selesai. */
  completedAt: string | null;
}

export interface StreakState {
  /** Jumlah hari berturut-turut user menyelesaikan ≥1 misi. */
  current: number;
  best: number;
  /** Tanggal lokal terakhir aktif, format YYYY-MM-DD. */
  lastActiveDate: string | null;
}

export interface UserProgress {
  version: 1;
  xp: number;
  streak: StreakState;
  missions: Record<string, MissionProgress>;
  /** ID misi terakhir yang dibuka (untuk resume). */
  lastMissionId: string | null;
}

export interface Rank {
  id: 'intern' | 'junior' | 'engineer' | 'senior' | 'specialist' | 'architect' | 'head' | 'director';
  title: string;
  minXp: number;
  /** Emoji/ikon pendek untuk badge. */
  icon: string;
}

export interface RankProgress {
  current: Rank;
  next: Rank | null;
  /** 0..1 progres menuju rank berikutnya (1 jika sudah rank tertinggi). */
  ratio: number;
  xpToNext: number;
}

/** Ringkasan yang dikembalikan saat misi diselesaikan, untuk animasi sukses. */
export interface CompletionSummary {
  missionId: string;
  xpGained: number;
  firstCompletion: boolean;
  rankUp: Rank | null;
  streak: StreakState;
  streakIncreased: boolean;
}

/* ------------------------------------------------------------------ */
/* Visualisasi query plan (Playground → Explain)                       */
/* ------------------------------------------------------------------ */

/** Satu baris mentah EXPLAIN QUERY PLAN. */
export interface PlanRow {
  id: number;
  parent: number;
  detail: string;
}

/**
 * Jenis langkah plan:
 * - full-scan     : SCAN tabel tanpa index — membaca seluruh baris
 * - index-scan    : SCAN tabel USING [COVERING] INDEX — seluruh index ditelusuri (bukan lompat)
 * - index-search  : SEARCH lewat index (lompat langsung ke baris yang cocok)
 * - rowid-search  : SEARCH lewat INTEGER PRIMARY KEY / rowid
 * - auto-index    : SEARCH lewat AUTOMATIC INDEX (index sementara dibangun saat query jalan)
 * - temp-btree    : USE TEMP B-TREE (pengurutan/pengelompokan di memori)
 * - bloom-filter  : BLOOM FILTER (saringan cepat sebelum pencarian)
 * - derived-scan  : SCAN hasil subquery/CTE/baris konstan (bukan tabel fisik)
 * - structure     : node pengelompok (subquery, co-routine, UNION, cabang OR, CTE rekursif, …)
 * - other         : baris yang belum dikenali — ditampilkan apa adanya
 */
export type PlanNodeKind =
  | 'full-scan'
  | 'index-scan'
  | 'index-search'
  | 'rowid-search'
  | 'auto-index'
  | 'temp-btree'
  | 'bloom-filter'
  | 'derived-scan'
  | 'structure'
  | 'other';

/** good = memakai index, warn = ada biaya tambahan, bad = full scan, info/neutral = penjelasan saja. */
export type PlanTone = 'good' | 'warn' | 'bad' | 'info' | 'neutral';

export interface PlanNode {
  id: number;
  parent: number;
  detail: string;
  kind: PlanNodeKind;
  tone: PlanTone;
  /** Label pendek, mis. "Full table scan". */
  title: string;
  /** Penjelasan berbahasa Indonesia. */
  explanation: string;
  /** Tabel fisik yang diakses (hasil resolusi alias/nama index), jika ada. */
  table: string | null;
  /** Nama objek seperti tertulis di plan (bisa alias, mis. "k"). */
  object: string | null;
  index: string | null;
  /** Kolom index (dari PRAGMA index_info), jika index dikenal. */
  indexColumns: string[];
  /** Isi kurung syarat pencarian, mis. "no_rm=?" atau "tgl>? AND tgl<?". */
  constraints: string | null;
  covering: boolean;
  /** Jumlah baris tabel saat Explain dijalankan (untuk konteks biaya full scan). */
  tableRows: number | null;
  /** true jika node berada di dalam subquery berkorelasi → dijalankan ulang per baris query luar. */
  repeated: boolean;
  /** true jika langkah akses ini adalah loop dalam JOIN (dijalankan per baris langkah sebelumnya). */
  innerLoop: boolean;
  /**
   * true jika langkah ini pengecekan FOREIGN KEY pada INSERT/UPDATE/DELETE (tabelnya tidak ditulis di query)
   * — dijalankan untuk setiap baris yang diubah.
   */
  fkCheck: boolean;
  /** true jika pembacaan bisa berhenti lebih awal karena LIMIT (tanpa pengurutan di memori). */
  stopsEarly: boolean;
  /** Saran SQL (mis. CREATE INDEX) untuk dicoba, jika relevan. */
  suggestion: string | null;
  children: PlanNode[];
}

export interface PlanTableAccess {
  table: string;
  /** Jenis akses terburuk pada tabel ini dalam statement. */
  kind: Extract<PlanNodeKind, 'full-scan' | 'index-scan' | 'index-search' | 'rowid-search' | 'auto-index'>;
  tone: PlanTone;
  rows: number | null;
}

export interface PlanSummary {
  tone: PlanTone;
  headline: string;
  tables: PlanTableAccess[];
  tips: string[];
}

export type StatementPlan =
  | {
      status: 'plan';
      /** Urutan statement di skrip (mulai 1). */
      index: number;
      sql: string;
      roots: PlanNode[];
      rows: PlanRow[];
      summary: PlanSummary;
      /**
       * true jika statement CREATE/DROP/ALTER sebelumnya di skrip yang sama belum dijalankan, sehingga
       * plan ini dihitung terhadap skema LAMA (Explain tidak menjalankan apa pun).
       */
      afterUnappliedDdl: boolean;
    }
  | { status: 'no-plan'; index: number; sql: string; reason: string }
  | { status: 'error'; index: number; sql: string; rawError: string; friendlyError: string };

export type PlanReport =
  | {
      ok: true;
      statements: StatementPlan[];
      /** Jumlah statement yang tidak dianalisis karena melewati batas tampilan. */
      omittedCount: number;
      /** true jika analisis berhenti di statement yang gagal di-parse (statement sesudahnya dilewati). */
      stoppedAtError: boolean;
      /** true jika ada statement gagal di-parse SETELAH batas tampilan (tidak ditampilkan, sisa skrip tidak dihitung). */
      errorAfterLimit: boolean;
    }
  | { ok: false; rawError: string; friendlyError: string };

/* ------------------------------------------------------------------ */
/* Materi (pustaka pembelajaran)                                       */
/* ------------------------------------------------------------------ */

/**
 * Contoh query di materi. Default (`run: 'inline'`): SELECT yang dijalankan di tempat pada database awal.
 * `run: 'playground'`: contoh yang MENGUBAH data (INSERT/UPDATE/DELETE/transaksi) — tidak dijalankan di tempat,
 * hanya bisa dibuka di Playground (yang bisa di-Reset Database).
 */
export interface ArticleExample {
  /** Judul pendek, mis. "Pasien BPJS dari Bandung". */
  title: string;
  sql: string;
  run?: 'inline' | 'playground';
  /** Apa yang perlu diperhatikan pada hasilnya (boleh memakai `kode` dan **tebal**). */
  note?: string;
}

export interface ArticleSection {
  heading: string;
  /** Paragraf dipisah "\n\n"; mendukung `kode`, **tebal**, dan daftar "- ". */
  body: string;
  examples?: ArticleExample[];
}

/** Dialek yang dibandingkan di kotak "Beda dialek". SQLite = mesin yang dipakai aplikasi ini. */
export type SqlDialect = 'sqlite' | 'sqlServer' | 'mysql' | 'postgresql' | 'oracle';

/** Satu baris perbandingan dialek, mis. "Ambil 5 baris pertama". Nilai berupa potongan kode singkat. */
export interface DialectNote {
  label: string;
  syntax: Record<SqlDialect, string>;
  /** Catatan tambahan (opsional). */
  note?: string;
}

/**
 * Artikel materi satu konsep. Kedalaman "menengah": penjelasan singkat, 2–3 contoh interaktif,
 * jebakan umum, dan perbandingan dialek. Contoh sengaja memakai skenario berbeda dari soal misi
 * terkait agar tidak membocorkan jawaban (diperiksa `npm run verify`).
 */
export interface Article {
  /** ID kebab-case stabil, mis. "left-join". Dipakai sebagai kunci status "sudah dibaca". */
  id: string;
  title: string;
  /** Satu kalimat ringkasan untuk daftar materi. */
  summary: string;
  /** Tier kurikulum tempat konsep ini pertama kali dipakai (untuk pengelompokan). */
  tier: Tier;
  /** ID misi yang memakai konsep ini; misi pertama di daftar = misi tempat konsep diperkenalkan. */
  missions: string[];
  sections: ArticleSection[];
  /** Kesalahan yang sering terjadi, satu kalimat per butir. */
  pitfalls: string[];
  dialects: DialectNote[];
}

/* ------------------------------------------------------------------ */
/* UI                                                                  */
/* ------------------------------------------------------------------ */

export type AppMode = 'mission' | 'playground' | 'reference' | 'progress' | 'exam';
export type LeftTab = 'mission' | 'materi' | 'schema';
