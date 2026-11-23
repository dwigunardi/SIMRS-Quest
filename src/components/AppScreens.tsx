import { PlatformError, PlatformLoading } from '../platform/screens';

export interface LoadingScreenProps {
  /** Kembali ke Beranda — mesin SQL yang lama/gagal dimuat tidak boleh menjebak pengguna. */
  onHome?: () => void;
}

export function LoadingScreen({ onHome }: LoadingScreenProps): JSX.Element {
  return <PlatformLoading title="Menyiapkan database SIMRS…" detail="Memuat SQLite (WebAssembly) dan data pasien dummy." onHome={onHome} />;
}

export interface ErrorScreenProps {
  message: string | null;
  onHome?: () => void;
}

export function ErrorScreen({ message, onHome }: ErrorScreenProps): JSX.Element {
  return (
    <PlatformError
      title="Gagal memuat database"
      description="Mesin SQL (sql.js) tidak bisa dijalankan di browser ini. Coba muat ulang halaman."
      message={message}
      onHome={onHome}
    />
  );
}
