/**
 * Registri jalur belajar + kontrak antara platform dan sebuah jalur.
 *
 * Modul ini RINGAN dan dimuat bersama Beranda: TIDAK BOLEH mengimpor data misi/materi, sql.js, atau komponen jalur
 * secara statis. Isi jalur hanya dijangkau lewat `load` (komponennya) dan `glance` (ringkasan untuk Beranda), dua-duanya
 * impor dinamis. scripts/verify/platform.ts memeriksa aturan registri DAN daftar impor statis berkas ini.
 */
import type { ComponentType } from 'react';
import { Atom, Braces, Database, Globe, Layers, type LucideIcon } from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Kontrak komponen jalur                                              */
/* ------------------------------------------------------------------ */

export interface TrackProps {
  /** false saat pengguna di Beranda: jalur tetap ter-mount ("satu jalur hangat") tetapi disembunyikan. */
  active: boolean;
  /** Sisa segmen URL setelah id jalur (mis. ['ujian']); kosong bila jalur dibuka tanpa tujuan khusus. */
  entry: readonly string[];
  /** Dipanggil jalur setelah `entry` diproses, supaya tidak diproses ulang. */
  onEntryConsumed: () => void;
  /** Kembali ke Beranda. */
  onHome: () => void;
}

/* ------------------------------------------------------------------ */
/* Ringkasan jalur untuk Beranda                                       */
/* ------------------------------------------------------------------ */

/** Ringkasan satu jalur, dihitung dari storage TANPA me-mount jalurnya. */
export interface TrackGlance {
  /** Pengguna pernah mengerjakan jalur ini. */
  started: boolean;
  /** Misi selesai / jumlah misi. */
  completed: number;
  total: number;
  xp: number;
  rank: { title: string; icon: string };
  /** Misi yang akan dibuka jalur ("Lanjutkan"); null = semua misi tuntas. */
  resume: { missionId: string; order: number; title: string; tierLabel: string } | null;
  streak: {
    /** Streak yang masih hidup (0 bila sudah putus). */
    active: number;
    best: number;
    /** Hari ini sudah dihitung aktif. */
    activeToday: boolean;
  };
  /** Jumlah latihan ulang yang jatuh tempo hari ini (tanggal lokal). */
  reviewDue: number;
  /** Ujian / latihan ulang yang sedang berjalan; `deadline` ISO atau null bila tanpa batas waktu. */
  exam: { purpose: 'exam' | 'review'; deadline: string | null; answered: number; total: number } | null;
  /** Jenis kesalahan teratas, hanya bila ada kesalahan dalam 7 hari terakhir. `count` = total kesalahan jenis itu. */
  weakness: { label: string; count: number } | null;
  /** Waktu (ISO) terakhir data jalur ini dikarantina karena tidak terbaca (lib/storageGuard), atau null. */
  quarantinedAt: string | null;
}

/** Fungsi murni: HANYA MEMBACA storage, tidak pernah menulis, tidak melempar. */
export type GlanceFn = (storage: Pick<Storage, 'getItem'>, now: Date) => TrackGlance;

/* ------------------------------------------------------------------ */
/* Manifest                                                            */
/* ------------------------------------------------------------------ */

export type TrackStatus = 'tersedia' | 'segera';

/** Kelas Tailwind warna aksen jalur. Ditulis UTUH di registri (bukan dirangkai) supaya terbaca pemindai Tailwind. */
export interface TrackAccent {
  text: string;
  bg: string;
  border: string;
}

export interface TrackManifest {
  /** Segmen URL jalur ('#/<id>'): huruf kecil a-z, angka, tanda hubung; bukan RESERVED_SEGMENTS. Stabil selamanya. */
  id: string;
  title: string;
  /** Satu baris di kartu jalur. */
  tagline: string;
  /** Satu–dua kalimat: apa yang dipelajari. */
  description: string;
  status: TrackStatus;
  icon: LucideIcon;
  accent: TrackAccent;
  /** Keterangan singkat di kartu, mis. '72 misi'. */
  meta: string[];
  /** Komponen jalur (hanya jalur 'tersedia'). */
  load?: () => Promise<{ default: ComponentType<TrackProps> }>;
  /** Ringkasan untuk Beranda (hanya jalur 'tersedia'). */
  glance?: () => Promise<{ glance: GlanceFn }>;
}

export const TRACKS: readonly TrackManifest[] = [
  {
    id: 'sql',
    title: 'SQL',
    tagline: 'Dari SELECT pertama sampai merancang tabel SIMRS.',
    description:
      'Menulis query di database rumah sakit sungguhan: menyaring, JOIN, agregasi, window function, transaksi, index, keamanan, hingga DDL — langsung di browser.',
    status: 'tersedia',
    icon: Database,
    accent: { text: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
    meta: ['72 misi', '10 tier', '39 materi'],
    load: () => import('../tracks/sql/SqlTrack'),
    glance: () => import('../tracks/sql/glance'),
  },
  {
    id: 'js',
    title: 'JavaScript & TypeScript',
    tagline: 'Logika di balik layar pendaftaran dan billing.',
    description:
      'Dasar bahasa sampai tipe yang ketat, dengan kasus SIMRS: mengolah data pasien, menghitung tagihan, dan menulis fungsi yang lolos pengujian — di editor browser.',
    status: 'segera',
    icon: Braces,
    accent: { text: 'text-amber-300', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
    meta: ['Di browser'],
  },
  {
    id: 'rest',
    title: 'REST API',
    tagline: 'Membuka data SIMRS lewat endpoint yang rapi.',
    description:
      'Merancang dan memanggil REST API di atas database SIMRS yang sama: resource, metode, kode status, validasi, dan paginasi.',
    status: 'segera',
    icon: Globe,
    accent: { text: 'text-sky-300', bg: 'bg-sky-500/10', border: 'border-sky-500/30' },
    meta: ['Di browser', 'Database SIMRS'],
  },
  {
    id: 'react',
    title: 'React',
    tagline: 'Antarmuka loket, antrean, dan rekam medis.',
    description:
      'Komponen, state, dan pengambilan data untuk layar-layar SIMRS — dari daftar pasien sampai formulir pendaftaran.',
    status: 'segera',
    icon: Atom,
    accent: { text: 'text-cyan-300', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' },
    meta: ['Di browser'],
  },
  {
    id: 'framework',
    title: 'NestJS · Next.js · Laravel',
    tagline: 'Proyek utuh dengan framework sungguhan.',
    description:
      'Membangun modul SIMRS sebagai proyek nyata: struktur proyek, migrasi, dan pengujian. Dikerjakan di VS Code dengan runner lokal yang melaporkan hasil test ke aplikasi.',
    status: 'segera',
    icon: Layers,
    accent: { text: 'text-violet-300', bg: 'bg-violet-500/10', border: 'border-violet-500/30' },
    meta: ['VS Code', 'Runner lokal'],
  },
];

export function getTrack(id: string): TrackManifest | undefined {
  return TRACKS.find((track) => track.id === id);
}
