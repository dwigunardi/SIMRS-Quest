/**
 * Karantina data tersimpan yang tidak bisa dibaca.
 *
 * Masalah yang dijaga: bila nilai di localStorage ADA tetapi rusak (JSON terpotong, bentuk ditolak parser), aplikasi
 * melanjutkan dengan data kosong — dan penyimpanan berikutnya MENIMPA kunci aslinya, sehingga nilai rusak itu (yang
 * mungkin masih bisa diselamatkan dengan tangan) hilang selamanya. Sebelum itu terjadi, salinan mentahnya disimpan di
 * kunci turunan `<kunci>:karantina`.
 *
 * Aturan:
 * - Hanya untuk nilai yang ada tetapi ditolak. Nilai tanpa isi (kosong, `null`, `[]`, `{}`, `{"events":[],"solved":{}}`)
 *   tidak dikarantina: tidak ada yang bisa hilang.
 * - Paling banyak MAX_QUARANTINE_SLOTS salinan per kunci; yang tertua dibuang. Isi yang sama tidak disimpan dua kali
 *   (pemuat dipanggil berulang: StrictMode, event `storage`, pembacaan ulang sebelum menulis).
 * - Tidak pernah melempar: kuota penuh / storage diblokir → karantina dilewati, aplikasi tetap jalan.
 *
 * Semua fungsi menerima storage sebagai parameter, jadi bisa diuji di Node (scripts/verify/platform.ts).
 */

export const QUARANTINE_SUFFIX = ':karantina';
export const MAX_QUARANTINE_SLOTS = 3;

export interface QuarantineSlot {
  /** ISO timestamp saat nilai dikarantina. */
  at: string;
  /** Nilai mentah persis seperti yang ada di storage. */
  raw: string;
}

export type GuardReader = Pick<Storage, 'getItem'>;
export type GuardStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function quarantineKey(key: string): string {
  return `${key}${QUARANTINE_SUFFIX}`;
}

/** Objek JSON biasa (bukan array, bukan null). */
function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSlot(value: unknown): value is QuarantineSlot {
  return isJsonRecord(value) && typeof value.at === 'string' && !Number.isNaN(Date.parse(value.at)) && typeof value.raw === 'string';
}

function getRaw(storage: GuardReader, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

/** null, atau wadah (array/objek) yang seluruh isinya juga tanpa isi. Angka, teks, dan boolean dihitung sebagai isi. */
function isBlankValue(value: unknown): boolean {
  if (value === null) return true;
  if (Array.isArray(value)) return value.every(isBlankValue);
  if (typeof value === 'object') return Object.values(value).every(isBlankValue);
  return false;
}

/**
 * Nilai mentah yang tidak membawa data apa pun: kosong/spasi, atau JSON yang hanya berisi wadah kosong. Teks yang BUKAN
 * JSON dianggap berisi (itulah kasus "rusak" yang ingin diselamatkan).
 */
export function isBlankRaw(raw: string): boolean {
  if (raw.trim() === '') return true;
  try {
    return isBlankValue(JSON.parse(raw));
  } catch {
    return false;
  }
}

/** Slot dari teks tersimpan; null bila teksnya sendiri tidak terbaca. */
function parseSlots(text: string): QuarantineSlot[] | null {
  try {
    const parsed: unknown = JSON.parse(text);
    if (!isJsonRecord(parsed) || !Array.isArray(parsed.slots)) return null;
    return parsed.slots.filter(isSlot);
  } catch {
    return null;
  }
}

/** Salinan yang dikarantina untuk `key`, tertua lebih dulu. Hanya membaca. */
export function readQuarantine(storage: GuardReader, key: string): QuarantineSlot[] {
  const text = getRaw(storage, quarantineKey(key));
  return text === null ? [] : (parseSlots(text) ?? []);
}

/**
 * Simpan salinan `raw` (nilai `key` yang ditolak) ke karantina. Mengembalikan true bila salinan BARU tertulis;
 * false bila tidak ada yang perlu/bisa ditulis (nilai tanpa isi, isi yang sama sudah ada, atau storage menolak).
 */
export function quarantine(storage: GuardStorage, key: string, raw: string | null | undefined, now: Date): boolean {
  if (typeof raw !== 'string' || isBlankRaw(raw)) return false;
  try {
    const target = quarantineKey(key);
    const existing = storage.getItem(target);
    let slots: QuarantineSlot[] = [];
    if (existing !== null) {
      // Isi karantina yang tidak terbaca pun tidak dibuang begitu saja: dibungkus sebagai satu slot.
      slots = parseSlots(existing) ?? [{ at: now.toISOString(), raw: existing }];
    }
    if (slots.some((slot) => slot.raw === raw)) return false;
    const next = [...slots, { at: now.toISOString(), raw }].slice(-MAX_QUARANTINE_SLOTS);
    storage.setItem(target, JSON.stringify({ slots: next }));
    return true;
  } catch {
    return false;
  }
}

/** Waktu (ISO) karantina TERBARU di antara `keys`, atau null bila belum pernah ada. Hanya membaca. */
export function lastQuarantinedAt(storage: GuardReader, keys: readonly string[]): string | null {
  let latest: string | null = null;
  for (const key of keys) {
    for (const slot of readQuarantine(storage, key)) {
      if (latest === null || Date.parse(slot.at) > Date.parse(latest)) latest = slot.at;
    }
  }
  return latest;
}

/**
 * Baca `key` lewat `parse` dengan penjagaan karantina. Hasilnya sama persis dengan memanggil `parse` langsung
 * (null bila kunci tidak ada, storage tidak bisa diakses, atau `parse` menolak/melempar); bedanya, nilai mentah
 * dikarantina lebih dulu bila SELURUH isinya terbuang:
 * - `parse` mengembalikan null atau melempar (mis. JSON.parse gagal), atau
 * - `isEmpty(hasil)` benar — parser yang "membersihkan" data rusak menjadi wadah kosong alih-alih menolaknya.
 * Nilai yang memang kosong (mis. `[]` setelah reset) tidak dikarantina; lihat isBlankRaw.
 */
export function readGuarded<T>(
  storage: GuardStorage | null | undefined,
  key: string,
  parse: (raw: string) => T | null,
  isEmpty?: (value: T) => boolean,
  now: Date = new Date(),
): T | null {
  if (!storage) return null;
  const raw = getRaw(storage, key);
  if (raw === null) return null;
  let value: T | null = null;
  try {
    value = parse(raw);
  } catch {
    value = null;
  }
  if (value === null || isEmpty?.(value) === true) quarantine(storage, key, raw, now);
  return value;
}

/** localStorage browser, atau null bila tidak tersedia (Node, atau browser yang memblokir akses storage). */
export function browserStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
