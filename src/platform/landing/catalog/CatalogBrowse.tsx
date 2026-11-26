/**
 * B2 — "Telusuri semua jalur": pencarian teks + chip saringan (Semua, Tersedia, Segera, Di browser, VS Code) di atas
 * grid kartu jalur 1/2/3 kolom. Jumlah hasil selalu terlihat dan diumumkan ke pembaca layar (aria-live). Tanpa hasil →
 * keadaan kosong yang menyebut penyebabnya: kata pencarian yang tidak cocok (tombol: tampilkan semua jalur) atau chip
 * saringan yang menyaring habis jalur yang cocok (tombol: lihat jalur yang cocok — saringan kembali ke Semua, kata
 * pencarian tetap). Setelah tombolnya ditekan fokus kembali ke kolom pencarian.
 *
 * Keyboard: kolom pencarian (Esc mengosongkannya), lalu chip saringan berupa tombol biasa (Tab, Enter/Spasi) dengan
 * aria-pressed. Angka di tiap chip = jumlah jalur yang akan tampil bila chip itu dipilih dengan kata pencarian saat ini.
 *
 * Kata pencarian & saringan diingat di entri riwayat katalog (layout/historyMemory.ts): membuka sebuah jalur lalu
 * menekan Kembali memulihkannya (bersama posisi gulir); membuka katalog lewat tautan mulai kosong.
 *
 * Data: COURSE_SUMMARIES + matchesQuery (courses/catalog.ts, ringan — tanpa data misi).
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { CATALOG_ROUTE, formatRoute } from '../../router';
import { COURSE_SUMMARIES, matchesQuery, type CourseSummary } from '../courses/catalog';
import { readMemory, writeMemory } from '../layout/historyMemory';
import { cn } from '../lib/cn';
import { spring } from '../lib/motion';
import { CATALOG, CATALOG_SECTION_IDS, type CatalogFilterId } from '../lib/pagesContent';
import { Button3D } from '../ui/Button3D';
import { CourseCard } from '../ui/CourseCard';
import { Section } from '../ui/Section';
import { SectionHeading } from '../ui/SectionHeading';

const TITLE_ID = 'catalog-browse-title';

function passesFilter(course: CourseSummary, filter: CatalogFilterId): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'tersedia':
    case 'segera':
      return course.status === filter;
    case 'browser':
    case 'vscode':
      return course.env === filter;
  }
}

const card = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
} as const;

/** Kunci history.state untuk isian katalog: kembali (tombol Kembali) dari halaman jalur memulihkan pencarian & saringan. */
const BROWSE_MEMORY = 'simrsQuestCatalogBrowse';
/** Jeda sebelum isian dicatat (mengetik tidak memanggil replaceState di setiap huruf). */
const BROWSE_SAVE_MS = 300;

interface BrowseMemory {
  query: string;
  filter: CatalogFilterId;
}

function isBrowseMemory(value: unknown): value is BrowseMemory {
  if (typeof value !== 'object' || value === null) return false;
  const { query, filter } = value as { query?: unknown; filter?: unknown };
  return typeof query === 'string' && CATALOG.browse.filters.some((item) => item.id === filter);
}

export function CatalogBrowse(): JSX.Element {
  const { browse } = CATALOG;
  // Entri riwayat ini pernah diisi (pengguna kembali ke katalog lewat tombol Kembali): pulihkan; selain itu mulai kosong.
  const [remembered] = useState(() => readMemory(BROWSE_MEMORY, formatRoute(CATALOG_ROUTE), isBrowseMemory));
  const [query, setQuery] = useState(remembered?.query ?? '');
  const [filter, setFilter] = useState<CatalogFilterId>(remembered?.filter ?? 'all');

  const latest = useRef<BrowseMemory>({ query, filter });
  latest.current = { query, filter };
  useEffect(() => {
    const timer = window.setTimeout(() => writeMemory(BROWSE_MEMORY, formatRoute(CATALOG_ROUTE), latest.current), BROWSE_SAVE_MS);
    return () => window.clearTimeout(timer);
  }, [query, filter]);
  useEffect(() => {
    // Klik kartu bisa datang sebelum jeda habis: catat dulu, selagi entri riwayatnya masih katalog.
    const flush = () => writeMemory(BROWSE_MEMORY, formatRoute(CATALOG_ROUTE), latest.current);
    document.addEventListener('click', flush, true);
    return () => document.removeEventListener('click', flush, true);
  }, []);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchId = useId();
  const indicatorId = useId();

  const available = COURSE_SUMMARIES.filter((course) => course.status === 'tersedia').length;
  const matching = useMemo(() => COURSE_SUMMARIES.filter((course) => matchesQuery(course, query)), [query]);
  const results = useMemo(() => matching.filter((course) => passesFilter(course, filter)), [matching, filter]);
  const counts = useMemo(
    () => Object.fromEntries(browse.filters.map((f) => [f.id, matching.filter((course) => passesFilter(course, f.id)).length])) as Record<CatalogFilterId, number>,
    [matching, browse.filters],
  );

  // Kosong karena saringan (kata pencariannya sendiri cocok dengan jalur lain) atau karena kata pencariannya.
  const filteredOut = results.length === 0 && matching.length > 0;
  const filterLabel = browse.filters.find((f) => f.id === filter)?.label ?? '';

  /** Tombol keadaan kosong. Tombolnya hilang setelah ditekan, jadi fokus dipindah ke kolom pencarian. */
  const recover = () => {
    if (!filteredOut) setQuery('');
    setFilter('all');
    searchRef.current?.focus();
  };

  const onSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && query !== '') {
      event.preventDefault();
      setQuery('');
    }
  };

  return (
    <Section id={CATALOG_SECTION_IDS.browse} labelledBy={TITLE_ID}>
      <SectionHeading id={TITLE_ID} title={browse.title} lead={browse.lead(available, COURSE_SUMMARIES.length - available)} align="start" />

      <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <form role="search" aria-label={browse.searchLabel} className="relative w-full lg:max-w-[380px]" onSubmit={(event) => event.preventDefault()}>
          <label htmlFor={searchId} className="sr-only">
            {browse.searchLabel}
          </label>
          <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-q-ink-soft" />
          <input
            ref={searchRef}
            id={searchId}
            type="text"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            spellCheck={false}
            value={query}
            placeholder={browse.searchPlaceholder}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onSearchKey}
            className="h-12 w-full rounded-q-pill border-2 border-q-border-strong bg-q-surface pl-12 pr-12 font-q-body text-base text-q-ink placeholder:text-q-ink-soft transition-colors duration-150 hover:border-q-ink-soft"
            data-testid="catalog-search"
          />
          {query !== '' ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                searchRef.current?.focus();
              }}
              aria-label={browse.clearSearch}
              className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-q-pill text-q-ink-soft transition-colors duration-150 hover:bg-q-muted hover:text-q-ink"
              data-testid="catalog-search-clear"
            >
              <X aria-hidden className="h-4 w-4" />
            </button>
          ) : null}
        </form>

        {/* Gulir mendatar di layar sempit; halaman sendiri tidak pernah ikut melebar. */}
        <fieldset className="q-no-scrollbar -mx-q-gutter my-0 min-w-0 overflow-x-auto border-0 px-q-gutter py-1 lg:mx-0 lg:px-0">
          <legend className="sr-only">{browse.filtersLabel}</legend>
          <div className="flex w-max items-center gap-1 rounded-q-pill border border-q-border bg-q-surface p-1" data-testid="catalog-filters">
            {browse.filters.map((item) => {
              const active = item.id === filter;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(item.id)}
                  data-filter={item.id}
                  className={cn(
                    'relative isolate inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-q-pill px-4 font-q-body text-sm font-bold transition-colors duration-150',
                    active ? 'text-q-on-primary' : 'text-q-ink-soft hover:text-q-ink',
                  )}
                >
                  {active ? <motion.span layoutId={indicatorId} transition={spring} aria-hidden className="absolute inset-0 -z-10 rounded-q-pill bg-q-primary" /> : null}
                  <span>{item.label}</span>
                  <span
                    className={cn(
                      'grid h-5 min-w-5 place-items-center rounded-q-pill px-1.5 text-[11px] leading-none tabular-nums',
                      active ? 'bg-q-on-primary text-q-primary' : 'bg-q-muted text-q-ink-soft',
                    )}
                  >
                    {counts[item.id]}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>

      <p role="status" aria-live="polite" className="m-0 mt-5 text-sm text-q-ink-soft" data-testid="catalog-result-count">
        {browse.resultCount(results.length)}
      </p>

      {results.length > 0 ? (
        <ul className="relative m-0 mt-4 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3" data-testid="catalog-results">
          <AnimatePresence mode="popLayout" initial={false}>
            {results.map((course) => (
              <motion.li key={course.id} layout variants={card} initial="initial" animate="animate" exit="exit" transition={spring}>
                <CourseCard course={course} showEnv />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      ) : (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-q-lg border-2 border-dashed border-q-border-strong px-6 py-12 text-center" data-testid="catalog-empty">
          <span aria-hidden className="grid h-14 w-14 place-items-center rounded-q-pill bg-q-muted text-q-ink-soft">
            <Search className="h-6 w-6" />
          </span>
          <h3 className="m-0 text-q-h3 font-bold text-q-ink">{browse.empty.title}</h3>
          <p className="m-0 max-w-[48ch] text-pretty leading-relaxed text-q-ink-soft [overflow-wrap:anywhere]">
            {filteredOut ? browse.empty.filtered(query, filterLabel, matching.length) : browse.empty.text(query)}
          </p>
          <div className="w-full pb-1 pt-2 sm:w-auto">
            <Button3D size="md" variant="outline" onClick={recover} className="w-full sm:w-auto" data-testid="catalog-reset">
              {filteredOut ? browse.empty.showMatches(matching.length) : browse.empty.reset}
            </Button3D>
          </div>
        </div>
      )}
    </Section>
  );
}
