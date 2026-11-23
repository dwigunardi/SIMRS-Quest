import { useCallback, useEffect, useRef, useState } from 'react';
import { browserStorage, readGuarded } from '../lib/storageGuard';
import { ARTICLE_READS_KEY } from '../lib/storageKeys';

/**
 * Daftar materi yang sudah dibuka, diingat di browser. Hanya untuk penanda "Konsep baru" — tidak memengaruhi XP.
 * Disinkronkan antar-tab lewat event `storage`. localStorage bisa tidak tersedia (mode privat) → berlaku untuk sesi ini saja.
 */
export const ARTICLE_READS_STORAGE_KEY = ARTICLE_READS_KEY;
const STORAGE_KEY = ARTICLE_READS_STORAGE_KEY;

/** Baca daftar materi yang sudah dibuka dari teks JSON (juga dipakai impor cadangan). */
export function parseArticleReads(raw: string | null): ReadonlySet<string> {
  try {
    const parsed: unknown = JSON.parse(raw ?? '[]');
    return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

/** Isi storage terbaru (null bila belum ada / storage tidak tersedia). Nilai yang ada tetapi tidak menyisakan satu id pun dikarantina dulu. */
export function readStoredArticleReads(): ReadonlySet<string> | null {
  return readGuarded(browserStorage(), STORAGE_KEY, parseArticleReads, (ids) => ids.size === 0);
}

function save(ids: ReadonlySet<string>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    /* penyimpanan penuh / tidak tersedia */
  }
}

export interface ArticleReads {
  read: ReadonlySet<string>;
  markRead: (articleId: string) => void;
  reset: () => void;
}

export function useArticleReads(): ArticleReads {
  const [read, setRead] = useState<ReadonlySet<string>>(() => readStoredArticleReads() ?? new Set());
  const readRef = useRef(read);
  readRef.current = read;

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) setRead(parseArticleReads(event.newValue));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const markRead = useCallback((articleId: string) => {
    // Gabungkan dengan isi storage terbaru (tab lain mungkin sudah menandai materi lain).
    const latest = readStoredArticleReads() ?? readRef.current;
    if (latest.has(articleId) && readRef.current.has(articleId)) return;
    const next = new Set(latest).add(articleId);
    save(next);
    readRef.current = next;
    setRead(next);
  }, []);

  const reset = useCallback(() => {
    const empty = new Set<string>();
    save(empty);
    readRef.current = empty;
    setRead(empty);
  }, []);

  return { read, markRead, reset };
}
