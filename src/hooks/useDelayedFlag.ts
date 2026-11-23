import { useEffect, useState } from 'react';

/**
 * `flag` yang baru bernilai true setelah bertahan `delayMs` (langsung false saat `flag` false).
 * Untuk indikator "sedang berjalan": query cepat (≈ puluhan ms) tidak membuat tampilan berkedip.
 */
export function useDelayedFlag(flag: boolean, delayMs = 250): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!flag) {
      setShown(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setShown(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [flag, delayMs]);
  return flag && shown;
}
