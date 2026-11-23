import type { Database } from 'sql.js';
import { FlaskConical } from 'lucide-react';
import { SchemaExplorer } from './SchemaExplorer';

export interface ExampleQuery {
  label: string;
  description: string;
  sql: string;
}

export const PLAYGROUND_EXAMPLES: ExampleQuery[] = [
  {
    label: 'Lihat 5 pasien pertama',
    description: 'SELECT sederhana dengan LIMIT.',
    sql: 'SELECT *\nFROM pasien\nLIMIT 5;',
  },
  {
    label: 'Kunjungan + nama pasien & dokter',
    description: 'JOIN tiga tabel lewat foreign key.',
    sql: [
      'SELECT k.no_rawat,',
      '       p.nama AS nama_pasien,',
      '       d.nama_dokter,',
      '       k.tgl_kunjungan,',
      '       k.status',
      'FROM kunjungan k',
      'JOIN pasien p ON p.no_rm = k.no_rm',
      'JOIN dokter d ON d.id_dokter = k.id_dokter',
      'ORDER BY k.tgl_kunjungan DESC',
      'LIMIT 10;',
    ].join('\n'),
  },
  {
    label: 'Jumlah kunjungan per poli',
    description: 'Agregasi dengan GROUP BY.',
    sql: [
      'SELECT pl.nama_poli,',
      '       COUNT(k.no_rawat) AS jumlah_kunjungan',
      'FROM poliklinik pl',
      'LEFT JOIN kunjungan k ON k.id_poli = pl.id_poli',
      'GROUP BY pl.id_poli, pl.nama_poli',
      'ORDER BY jumlah_kunjungan DESC;',
    ].join('\n'),
  },
  {
    label: 'Ubah data (demo Reset Database)',
    description: 'UPDATE mengubah database sesi — lalu coba Reset Database.',
    sql: [
      "-- Tandai semua tagihan sebagai lunas, lalu cek hasilnya",
      "UPDATE billing SET status_bayar = 'Lunas';",
      '',
      'SELECT status_bayar, COUNT(*) AS jumlah',
      'FROM billing',
      'GROUP BY status_bayar;',
    ].join('\n'),
  },
  {
    label: 'CTE: rata-rata tagihan per penjamin',
    description: 'WITH … AS (…) memberi nama pada subquery agar query utama lebih mudah dibaca.',
    sql: [
      '-- CTE = "tabel sementara bernama" yang hanya hidup selama query ini',
      'WITH tagihan_pasien AS (',
      '  SELECT p.penjamin, b.total_biaya',
      '  FROM billing b',
      '  JOIN kunjungan k ON k.no_rawat = b.no_rawat',
      '  JOIN pasien p ON p.no_rm = k.no_rm',
      ')',
      'SELECT penjamin,',
      '       COUNT(*) AS jumlah_tagihan,',
      '       ROUND(AVG(total_biaya)) AS rata_rata',
      'FROM tagihan_pasien',
      'GROUP BY penjamin',
      'ORDER BY rata_rata DESC;',
    ].join('\n'),
  },
  {
    label: 'Window function: kunjungan ke-berapa',
    description: 'ROW_NUMBER() OVER (PARTITION BY …) memberi nomor urut per pasien tanpa GROUP BY.',
    sql: [
      'SELECT no_rm,',
      '       no_rawat,',
      '       tgl_kunjungan,',
      '       ROW_NUMBER() OVER (',
      '         PARTITION BY no_rm',
      '         ORDER BY tgl_kunjungan, no_rawat',
      '       ) AS kunjungan_ke',
      'FROM kunjungan',
      'ORDER BY no_rm, kunjungan_ke;',
    ].join('\n'),
  },
  {
    label: 'WITH RECURSIVE: rantai atasan',
    description: 'Menelusuri struktur organisasi dari Koordinator Poli naik sampai Direktur Utama.',
    sql: [
      '-- Anchor: titik awal. Bagian rekursif: cari atasan dari baris sebelumnya.',
      'WITH RECURSIVE rantai (id_jabatan, nama_jabatan, nama_pejabat, id_atasan, langkah) AS (',
      '  SELECT id_jabatan, nama_jabatan, nama_pejabat, id_atasan, 0',
      '  FROM struktur_organisasi',
      "  WHERE id_jabatan = 'J19'",
      '  UNION ALL',
      '  SELECT s.id_jabatan, s.nama_jabatan, s.nama_pejabat, s.id_atasan, r.langkah + 1',
      '  FROM struktur_organisasi s',
      '  JOIN rantai r ON s.id_jabatan = r.id_atasan',
      ')',
      'SELECT langkah, id_jabatan, nama_jabatan, nama_pejabat',
      'FROM rantai',
      'ORDER BY langkah;',
    ].join('\n'),
  },
  {
    label: 'FULL OUTER JOIN: Selesai vs Dirawat',
    description: 'Gabungkan dua rekap per poli; baris yang hanya ada di salah satu sisi tetap muncul.',
    sql: [
      'WITH selesai AS (',
      "  SELECT id_poli, COUNT(*) AS n FROM kunjungan WHERE status = 'Selesai' GROUP BY id_poli",
      '), dirawat AS (',
      "  SELECT id_poli, COUNT(*) AS n FROM kunjungan WHERE status = 'Dirawat' GROUP BY id_poli",
      ')',
      'SELECT COALESCE(s.id_poli, d.id_poli) AS id_poli,',
      '       COALESCE(s.n, 0) AS selesai,',
      '       COALESCE(d.n, 0) AS dirawat',
      'FROM selesai s',
      'FULL OUTER JOIN dirawat d ON d.id_poli = s.id_poli',
      'ORDER BY id_poli;',
    ].join('\n'),
  },
  {
    label: 'Transaksi: BEGIN … ROLLBACK',
    description: 'Perubahan di dalam transaksi bisa dibatalkan seluruhnya — data kembali seperti semula.',
    sql: [
      'BEGIN;',
      "UPDATE billing SET status_bayar = 'Lunas';",
      '',
      "SELECT 'di dalam transaksi' AS saat, status_bayar, COUNT(*) AS jumlah",
      'FROM billing GROUP BY status_bayar;',
      '',
      'ROLLBACK;',
      '',
      "SELECT 'setelah ROLLBACK' AS saat, status_bayar, COUNT(*) AS jumlah",
      'FROM billing GROUP BY status_bayar;',
    ].join('\n'),
  },
  {
    label: 'Explain: subquery berkorelasi',
    description:
      'Klik Explain: tabel dokter dibaca ulang untuk SETIAP poli. Lalu Run baris CREATE INDEX di komentar contoh ini, dan Explain lagi.',
    sql: [
      '-- Klik Explain (bukan Run) untuk melihat query plan-nya',
      'SELECT pl.nama_poli,',
      '       (SELECT COUNT(*)',
      '        FROM dokter d',
      '        WHERE d.id_poli = pl.id_poli) AS jumlah_dokter',
      'FROM poliklinik pl;',
      '',
      '-- Langkah 2: hapus "--" di baris bawah, Run, lalu Explain lagi',
      '-- CREATE INDEX IF NOT EXISTS idx_dokter_id_poli ON dokter (id_poli);',
    ].join('\n'),
  },
  {
    label: 'Explain: JOIN tanpa index',
    description: 'SQLite terpaksa membangun index sementara (AUTOMATIC INDEX). Klik "Buat index ini" di plan dan lihat perubahannya.',
    sql: [
      '-- Klik Explain: kunjungan.id_poli belum punya index',
      'SELECT d.nama_dokter, COUNT(*) AS jumlah_kunjungan_poli',
      'FROM dokter d',
      'JOIN kunjungan k ON k.id_poli = d.id_poli',
      'GROUP BY d.id_dokter, d.nama_dokter;',
    ].join('\n'),
  },
  {
    label: 'Explain: fungsi pada kolom vs rentang',
    description: 'Dua query dengan hasil sama — klik Explain dan bandingkan: SCAN (fungsi membungkus kolom) vs SEARCH (rentang).',
    sql: [
      '-- 1) Kolom dibungkus fungsi → index tidak bisa dipakai',
      'SELECT no_rawat, tgl_kunjungan',
      'FROM kunjungan',
      "WHERE substr(tgl_kunjungan, 1, 7) = '2026-10';",
      '',
      '-- 2) Rentang pada kolom asli → index idx_kunjungan_tgl dipakai',
      'SELECT no_rawat, tgl_kunjungan',
      'FROM kunjungan',
      "WHERE tgl_kunjungan >= '2026-10-01' AND tgl_kunjungan < '2026-11-01';",
    ].join('\n'),
  },
  {
    label: 'Index: EXPLAIN QUERY PLAN manual',
    description:
      'Versi teks lewat Run: plan sebelum & sesudah CREATE INDEX dalam satu skrip (index bertahan sampai Reset Database).',
    sql: [
      '-- Sebelum: SCAN pasien (membaca seluruh tabel)',
      'EXPLAIN QUERY PLAN',
      "SELECT no_rm, nama FROM pasien WHERE nama = 'Budi Santoso';",
      '',
      'CREATE INDEX IF NOT EXISTS idx_pasien_nama ON pasien (nama);',
      '',
      '-- Sesudah: SEARCH pasien USING INDEX idx_pasien_nama',
      'EXPLAIN QUERY PLAN',
      "SELECT no_rm, nama FROM pasien WHERE nama = 'Budi Santoso';",
    ].join('\n'),
  },
];

export interface PlaygroundSidebarProps {
  db: Database | null;
  dbVersion: number;
  onLoadExample: (sql: string) => void;
}

export function PlaygroundSidebar({ db, dbVersion, onLoadExample }: PlaygroundSidebarProps) {
  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-100">
          <FlaskConical className="h-4 w-4 text-amber-400" aria-hidden />
          Contoh query
        </h2>
        <ul className="space-y-2">
          {PLAYGROUND_EXAMPLES.map((example) => (
            <li key={example.label}>
              <button
                type="button"
                onClick={() => onLoadExample(example.sql)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-left transition hover:border-emerald-500/40 hover:bg-slate-800/60"
              >
                <span className="block text-sm font-medium text-slate-200">{example.label}</span>
                <span className="block text-xs text-slate-500">{example.description}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <SchemaExplorer db={db} dbVersion={dbVersion} />
    </div>
  );
}
