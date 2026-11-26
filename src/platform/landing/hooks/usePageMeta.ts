/**
 * Judul tab, meta description, og:title/og:description, (opsional) robots, dan JSON-LD satu halaman — dipasang saat
 * halaman tampil dan DIPULIHKAN saat halaman dilepas (nilai lama dikembalikan, elemen yang dibuat dihapus). Pengganti
 * kecil react-helmet-async.
 *
 *   usePageMeta({ title, description, ogTitle, ogDescription, jsonLd });
 *
 * Urutan efek: efek komponen anak berjalan SEBELUM efek induk. Shell (PlatformShell) hanya menulis document.title di
 * Beranda dan di layar jalur, tidak di halaman katalog/landing — jadi judul dari hook ini tidak ditimpa.
 *
 * Dipakai di layout effect supaya judul sudah benar sebelum browser menggambar. Aman di StrictMode (pasang → lepas →
 * pasang menghasilkan keadaan yang sama).
 */
import { useLayoutEffect } from 'react';

export interface PageMeta {
  /** document.title. */
  title: string;
  /** <meta name="description">. */
  description: string;
  /** <meta property="og:title">; bawaan = title. */
  ogTitle?: string;
  /** <meta property="og:description">; bawaan = description. */
  ogDescription?: string;
  /** <meta name="robots">, mis. 'noindex' untuk halaman 404. */
  robots?: string;
  /** Objek JSON-LD (mis. { '@context': 'https://schema.org', '@graph': [...] }); dipasang di SATU <script>. */
  jsonLd?: Readonly<Record<string, unknown>> | null;
}

/** Penanda elemen yang dipasang hook ini (untuk uji & supaya tidak bentrok dengan elemen lain). */
export const PAGE_META_ATTR = 'data-q-page-meta';

type MetaKey = { attr: 'name' | 'property'; key: string };

const DESCRIPTION: MetaKey = { attr: 'name', key: 'description' };
const OG_TITLE: MetaKey = { attr: 'property', key: 'og:title' };
const OG_DESCRIPTION: MetaKey = { attr: 'property', key: 'og:description' };
const ROBOTS: MetaKey = { attr: 'name', key: 'robots' };

/** Tulis <meta>; kembalikan fungsi pemulih (nilai lama, atau hapus elemen yang dibuat di sini). */
function setMeta({ attr, key }: MetaKey, content: string): () => void {
  const existing = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (existing) {
    const previous = existing.getAttribute('content');
    existing.setAttribute('content', content);
    return () => {
      if (previous === null) existing.removeAttribute('content');
      else existing.setAttribute('content', previous);
    };
  }
  const meta = document.createElement('meta');
  meta.setAttribute(attr, key);
  meta.setAttribute('content', content);
  meta.setAttribute(PAGE_META_ATTR, '');
  document.head.appendChild(meta);
  return () => meta.remove();
}

/** JSON di dalam <script> tidak boleh memuat "</script>": "<" ditulis sebagai < (tetap JSON yang sah). */
function serializeJsonLd(data: Readonly<Record<string, unknown>>): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function usePageMeta(meta: PageMeta): void {
  const { title, description, ogTitle, ogDescription, robots, jsonLd } = meta;
  // Objek JSON-LD biasanya dibuat ulang tiap render: bandingkan isinya, bukan identitasnya.
  const jsonText = jsonLd ? serializeJsonLd(jsonLd) : null;

  useLayoutEffect(() => {
    const previousTitle = document.title;
    document.title = title;
    const restore: Array<() => void> = [
      setMeta(DESCRIPTION, description),
      setMeta(OG_TITLE, ogTitle ?? title),
      setMeta(OG_DESCRIPTION, ogDescription ?? description),
    ];
    if (robots !== undefined) restore.push(setMeta(ROBOTS, robots));
    if (jsonText !== null) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute(PAGE_META_ATTR, '');
      script.textContent = jsonText;
      document.head.appendChild(script);
      restore.push(() => script.remove());
    }
    return () => {
      for (const undo of restore.reverse()) undo();
      document.title = previousTitle;
    };
  }, [title, description, ogTitle, ogDescription, robots, jsonText]);
}
