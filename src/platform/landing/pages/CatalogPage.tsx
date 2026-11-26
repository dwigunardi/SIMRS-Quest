/**
 * Katalog semua jalur ('#/landing'): B1 hero → B2 telusuri semua jalur → B3 "Belum tahu mulai dari mana?" →
 * B4 urutan yang disarankan → B5 cara kerja, FAQ katalog, CTA penutup. Dimuat malas oleh shell sebagai chunk sendiri.
 *
 * Irama latar berselang: hero bergradien (putih → mint), telusuri (putih), mulai dari mana (mint, kartu putih), urutan
 * (putih), cara kerja (mint), FAQ dan CTA penutup (putih, seperti akhir Beranda).
 *
 * Teks: CATALOG di lib/pagesContent.ts. Data jalur: courses/catalog.ts (RINGAN — halaman ini tidak memuat data misi).
 * Bagian-bagiannya ada di src/platform/landing/catalog/ (milik pembangun katalog, bersama berkas ini).
 */
import { useMemo } from 'react';
import { COURSE_SUMMARIES } from '../courses/catalog';
import { catalogJsonLd, pageBaseUrl } from '../courses/seo';
import { usePageMeta } from '../hooks/usePageMeta';
import { PageLayout } from '../layout/PageLayout';
import { CATALOG_META } from '../lib/pagesContent';
import { CatalogBrowse } from '../catalog/CatalogBrowse';
import { CatalogCta } from '../catalog/CatalogCta';
import { CatalogFaq } from '../catalog/CatalogFaq';
import { CatalogHero } from '../catalog/CatalogHero';
import { CatalogHow } from '../catalog/CatalogHow';
import { CatalogOrder } from '../catalog/CatalogOrder';
import { CatalogStart } from '../catalog/CatalogStart';

export default function CatalogPage(): JSX.Element {
  const jsonLd = useMemo(() => catalogJsonLd(COURSE_SUMMARIES, pageBaseUrl()), []);
  usePageMeta({ ...CATALOG_META, jsonLd });
  return (
    <PageLayout current={{ page: 'catalog' }}>
      <CatalogHero />
      <CatalogBrowse />
      <CatalogStart />
      <CatalogOrder />
      <CatalogHow />
      <CatalogFaq />
      <CatalogCta />
    </PageLayout>
  );
}
