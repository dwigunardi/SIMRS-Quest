/**
 * Nama produk. SATU-SATUNYA tempat nama platform ditulis — namanya masih bisa berubah, jadi komponen platform
 * wajib mengimpor dari sini, bukan menulis teksnya sendiri.
 *
 * Yang TIDAK ikut berubah bila nama ini diganti: awalan kunci localStorage (lib/storageKeys.ts) dan penanda file
 * cadangan (BACKUP_APP di lib/backup.ts). Keduanya beku demi data pengguna yang sudah ada.
 */
export const PRODUCT_NAME = 'SIMRS Quest';

export const PRODUCT_TAGLINE = 'Belajar membangun sistem informasi rumah sakit, satu misi demi satu misi.';
