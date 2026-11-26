import { cn } from '../lib/cn';

export interface BreadcrumbItem {
  label: string;
  /** Tujuan tautan (hash rute). Butir terakhir = halaman ini, selalu tanpa tautan. */
  href?: string;
}

export interface BreadcrumbProps {
  items: readonly BreadcrumbItem[];
  className?: string;
}

/**
 * Jejak halaman semantik: <nav aria-label="Breadcrumb"><ol>…</ol></nav>. Butir terakhir tebal dengan
 * aria-current="page"; pemisah "/" hanya hiasan (disembunyikan dari pembaca layar).
 *
 *   <Breadcrumb items={[{ label: 'Beranda', href: '#/' }, { label: 'Jalur', href: '#/landing' }, { label: 'SQL' }]} />
 */
export function Breadcrumb({ items, className }: BreadcrumbProps): JSX.Element {
  return (
    <nav aria-label="Breadcrumb" className={cn('font-q-body text-sm', className)}>
      <ol className="m-0 flex list-none flex-wrap items-center gap-x-2 gap-y-1 p-0 text-q-ink-soft">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${index}-${item.label}`} className="inline-flex min-w-0 items-center gap-2">
              {last || item.href === undefined ? (
                <span aria-current={last ? 'page' : undefined} className={cn('truncate', last ? 'font-bold text-q-ink' : '')}>
                  {item.label}
                </span>
              ) : (
                <a
                  href={item.href}
                  className="rounded text-q-ink-soft underline decoration-transparent underline-offset-4 transition-colors duration-150 hover:text-q-primary-ink hover:decoration-q-primary-ink/50"
                >
                  {item.label}
                </a>
              )}
              {last ? null : (
                <span aria-hidden className="select-none text-q-ink-soft/70">
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
