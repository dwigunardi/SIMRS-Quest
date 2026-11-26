/**
 * Titik tengah pada nama jalur ("NestJS · Next.js · Laravel") menempel ke kata sebelumnya (spasi tak-terputus), jadi
 * baris judul yang panjang tidak pernah diawali "·". Hanya tampilan: teksnya tetap sama untuk pembaca layar.
 */
export function keepDots(text: string): string {
  return text.replace(/ · /g, ' · ');
}
