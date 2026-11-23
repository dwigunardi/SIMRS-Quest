/**
 * Pengecekan konstruksi SQL wajib (mis. WITH, OVER, BEGIN/COMMIT) pada SQL user.
 * Komentar & string literal dibuang dulu agar `-- WITH` atau `'OVER('` tidak lolos.
 */
import type { RequiredPattern } from '../types';
import { stripCommentsAndStrings } from './sqlEngine';

function compile(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern, 'i');
  } catch {
    return null;
  }
}

/** Pola yang TIDAK ditemukan di SQL. Pola regex tidak valid diabaikan (ditangkap `npm run verify`). */
export function findMissingPatterns(sql: string, patterns: readonly RequiredPattern[] | undefined): RequiredPattern[] {
  if (!patterns || patterns.length === 0) return [];
  const cleaned = stripCommentsAndStrings(sql);
  return patterns.filter((p) => {
    const regex = compile(p.pattern);
    return regex !== null && !regex.test(cleaned);
  });
}

/** true jika sumber regex bisa dikompilasi. */
export function isValidPattern(pattern: string): boolean {
  return compile(pattern) !== null;
}

/** Pesan gabungan untuk alasan 'missing-construct'. */
export function missingConstructMessage(missing: readonly RequiredPattern[]): string {
  const details = missing.map((p) => p.message).join(' ');
  return `Hasilnya sudah sesuai, tetapi query kamu belum memakai konstruksi yang menjadi inti misi ini. ${details}`;
}

/** Catatan pengingat (dipakai saat hasil masih salah dan konstruksi wajib juga belum dipakai). */
export function missingConstructNote(missing: readonly RequiredPattern[]): string {
  return `Ingat, misi ini juga mewajibkan: ${missing.map((p) => p.message).join(' ')}`;
}
