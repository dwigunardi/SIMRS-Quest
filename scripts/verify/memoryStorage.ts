/**
 * Storage tiruan (pengganti localStorage) untuk verifikasi di Node, plus perbandingan nilai JSON yang menyebut
 * LETAK perbedaannya — pesan "berbeda" saja tidak membantu saat fixture emas merah.
 */

export class MemoryStorage implements Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  private readonly data = new Map<string, string>();
  /** Jumlah setItem/removeItem yang BERHASIL (untuk membuktikan sebuah fungsi hanya membaca). */
  writes = 0;
  /** true → setItem melempar seperti kuota penuh. */
  failWrites = false;
  /** true → getItem melempar seperti storage yang diblokir. */
  failReads = false;

  constructor(initial: Readonly<Record<string, string>> = {}) {
    for (const [key, value] of Object.entries(initial)) this.data.set(key, value);
  }

  getItem(key: string): string | null {
    if (this.failReads) throw new Error('SecurityError');
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) throw new Error('QuotaExceededError');
    this.data.set(key, value);
    this.writes += 1;
  }

  removeItem(key: string): void {
    this.data.delete(key);
    this.writes += 1;
  }

  keys(): string[] {
    return [...this.data.keys()].sort((a, b) => a.localeCompare(b));
  }
}

/** Storage berisi nilai-nilai JSON (key → nilai), ditulis seperti aplikasi menulisnya: JSON.stringify per kunci. */
export function storageFromValues(values: Readonly<Record<string, unknown>>): MemoryStorage {
  return new MemoryStorage(Object.fromEntries(Object.entries(values).map(([key, value]) => [key, JSON.stringify(value)])));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const show = (value: unknown) => {
  const text = value === undefined ? 'tidak ada' : JSON.stringify(value);
  return text.length > 80 ? `${text.slice(0, 77)}…` : text;
};

/**
 * Perbedaan pertama antara dua nilai JSON, atau null bila sama persis. Urutan kunci objek tidak dihitung; urutan dan
 * panjang array dihitung.
 */
export function firstDifference(actual: unknown, expected: unknown, path = '$'): string | null {
  if (Array.isArray(actual) && Array.isArray(expected)) {
    if (actual.length !== expected.length) return `${path}: panjang ${actual.length}, seharusnya ${expected.length}`;
    for (let i = 0; i < expected.length; i += 1) {
      const diff = firstDifference(actual[i], expected[i], `${path}[${i}]`);
      if (diff) return diff;
    }
    return null;
  }
  if (isObject(actual) && isObject(expected)) {
    for (const key of new Set([...Object.keys(expected), ...Object.keys(actual)])) {
      const diff = firstDifference(actual[key], expected[key], `${path}.${key}`);
      if (diff) return diff;
    }
    return null;
  }
  return Object.is(actual, expected) ? null : `${path}: ${show(actual)}, seharusnya ${show(expected)}`;
}
