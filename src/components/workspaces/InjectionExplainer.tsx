import { useId, useState } from 'react';
import { ChevronDown, ChevronRight, Lock, ShieldCheck } from 'lucide-react';
import { HighlightedCode } from '../HighlightedCode';
import type { InjectionLab } from '../../types';

function attackExplanation(lab: InjectionLab): string {
  switch (lab.goal.type) {
    case 'row-count-at-least':
    case 'contains-all-values':
      return 'Payload tautologi seperti `\' OR \'1\'=\'1` menutup string milik server lebih awal, lalu menambahkan kondisi yang SELALU benar. Klausa WHERE yang seharusnya menyaring satu pasien berubah menjadi "semua baris lolos" — data seluruh pasien bocor ke halaman.';
    case 'contains-value':
      return 'Dengan `UNION SELECT`, penyerang menempelkan query KEDUA ke query milik server. Asal jumlah (dan kira-kira tipe) kolomnya sama, hasil dari tabel lain — misalnya tagihan pasien — ikut tampil di halaman seolah-olah data biasa. Komentar `--` di akhir membuang sisa SQL server yang akan merusak sintaks.';
    default: {
      const unreachable: never = lab.goal;
      return unreachable;
    }
  }
}

/** Render teks dengan `kode` dalam backtick menjadi <code>. */
function InlineCode({ text }: { text: string }) {
  const parts = text.split(/`([^`]+)`/);
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <code key={index} className="rounded bg-slate-800 px-1 py-px font-mono text-[12px] text-violet-200">
            {part}
          </code>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}

const PREVENTION: string[] = [
  'Pakai prepared statement / parameterized query untuk SETIAP nilai dari user. Database menerima struktur query dan datanya secara terpisah, sehingga input tidak mungkin berubah menjadi kode SQL.',
  'Jangan andalkan escaping manual atau blacklist kata (mis. memblokir "OR" atau tanda kutip) — selalu ada celah encoding, komentar, atau variasi yang lolos.',
  'Prinsip least privilege: akun database aplikasi hanya diberi hak yang benar-benar dibutuhkan (mis. tanpa DROP / akses tabel billing untuk modul pendaftaran).',
  'Jangan tampilkan pesan error database mentah ke pengguna — pesan itu membocorkan struktur query dan memudahkan penyerang.',
  'Validasi input dengan allowlist (mis. format No. RM `RM-0000`) sebagai lapisan tambahan, bukan pengganti prepared statement.',
];

export interface InjectionExplainerProps {
  lab: InjectionLab;
  /** Saat serangan berhasil, panel otomatis terbuka (kecuali user sudah menutup/membukanya sendiri). */
  succeeded: boolean;
  /**
   * true jika penjelasan teknik serangan (yang memuat contoh payload) boleh ditampilkan: serangan sudah
   * berhasil, misi sudah selesai, atau solusi sudah dibuka. Sebelum itu hanya perbandingan template dan
   * daftar pencegahan yang tampil, agar panel ini tidak menjadi jalan pintas melewati aturan 0 XP solusi.
   */
  revealAttack: boolean;
}

export function InjectionExplainer({ lab, succeeded, revealAttack }: InjectionExplainerProps) {
  // null = ikuti otomatis (terbuka setelah sukses); boolean = pilihan user.
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const open = userOpen ?? succeeded;
  const panelId = useId();

  return (
    <section className="rounded-xl border border-violet-500/30 bg-violet-950/15">
      <button
        type="button"
        onClick={() => setUserOpen(!open)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <ShieldCheck className="h-4 w-4 text-violet-300" aria-hidden />
        <span className="text-sm font-semibold text-violet-200">Kenapa ini berbahaya &amp; cara mencegahnya</span>
        <span className="ml-auto text-slate-500">
          {open ? <ChevronDown className="h-4 w-4" aria-hidden /> : <ChevronRight className="h-4 w-4" aria-hidden />}
        </span>
      </button>
      {open ? (
        <div id={panelId} className="space-y-3 border-t border-violet-500/20 px-4 pb-4 pt-3 text-sm leading-relaxed text-slate-300">
          {revealAttack ? (
            <p>
              <InlineCode text={attackExplanation(lab)} />
            </p>
          ) : (
            <p className="flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-[13px] text-slate-400">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-300" aria-hidden />
              <span>
                Penjelasan teknik serangan (beserta contoh payload-nya) terbuka setelah serangan kamu berhasil, atau setelah kamu
                membuka solusi. Coba dulu dengan bantuan hint!
              </span>
            </p>
          )}
          <p>
            Di sistem rumah sakit, kebocoran seperti ini berarti data rekam medis dan keuangan pasien terekspos — pelanggaran
            serius terhadap kerahasiaan pasien dan UU Pelindungan Data Pribadi.
          </p>
          <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
            <div className="overflow-hidden rounded-lg border border-rose-500/30 bg-slate-950">
              <p className="border-b border-rose-500/20 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-rose-300">
                Rentan — input disambung ke teks SQL
              </p>
              <HighlightedCode code={lab.vulnerableTemplate} className="p-3" />
            </div>
            <div className="overflow-hidden rounded-lg border border-emerald-500/30 bg-slate-950">
              <p className="border-b border-emerald-500/20 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
                Aman — input di-bind ke placeholder ?
              </p>
              <HighlightedCode code={lab.safeTemplate} className="p-3" />
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-violet-300">Cara mencegah</p>
            <ul className="list-disc space-y-1 pl-5 text-[13px]">
              {PREVENTION.map((item) => (
                <li key={item}>
                  <InlineCode text={item} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </section>
  );
}
