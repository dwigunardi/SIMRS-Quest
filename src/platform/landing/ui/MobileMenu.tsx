/**
 * Menu layar sempit: tombol hamburger yang membuka panel geser dari kanan (Radix Dialog — fokus terkurung di dalam,
 * Esc / klik di luar menutup, fokus kembali ke tombol).
 *
 *   <MobileMenu title={NAV.mobile.title} openLabel={NAV.mobile.open} closeLabel={NAV.mobile.close} footer={<Button3D … />}>
 *     <MobileMenuSection title="Jalur">
 *       <MobileMenuLink href="#/sql" icon={<Icon name="database" />}>SQL</MobileMenuLink>
 *       <MobileMenuLink icon={…} badge={<Pill size="sm" tone="soon">Segera</Pill>}>React</MobileMenuLink>  ← tanpa href
 *     </MobileMenuSection>
 *   </MobileMenu>
 */
import { useId, useState, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { ExternalLink, Menu, X } from 'lucide-react';
import { NAV } from '../lib/content';
import { cn } from '../lib/cn';
import { crossfade, spring } from '../lib/motion';

const ICON_BUTTON =
  'grid h-9 w-9 shrink-0 place-items-center rounded-q border border-q-border bg-q-surface text-q-ink transition-colors duration-150 hover:bg-q-muted';

export interface MobileMenuProps {
  /** Judul panel (juga nama aksesibel dialog). */
  title: string;
  /** aria-label tombol hamburger. */
  openLabel: string;
  /** aria-label tombol tutup. */
  closeLabel: string;
  children: ReactNode;
  /** Isi tetap di dasar panel, mis. tombol utama. */
  footer?: ReactNode;
  /** Kelas tombol hamburger (mis. 'lg:hidden'). */
  className?: string;
}

export function MobileMenu({ title, openLabel, closeLabel, children, footer, className }: MobileMenuProps): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" aria-label={openLabel} className={cn(ICON_BUTTON, className)}>
          <Menu aria-hidden className="h-5 w-5" />
        </button>
      </Dialog.Trigger>
      <AnimatePresence>
        {open ? (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div className="fixed inset-0 z-50 bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={crossfade} />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                className="fixed inset-y-0 right-0 z-50 flex w-[min(88vw,360px)] flex-col border-l border-q-border bg-q-surface font-q-body text-q-ink shadow-q-pop"
                initial={{ x: '100%', opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                // Menutup lebih singkat daripada membuka: pegas butuh >0,5 dtk untuk tenang, dan selama itu panel masih
                // menutupi halaman serta menahan fokus.
                exit={{ x: '100%', opacity: 0, transition: crossfade }}
                transition={spring}
              >
                <div className="flex h-q-nav shrink-0 items-center justify-between gap-3 border-b border-q-border px-q-gutter">
                  <Dialog.Title className="m-0 text-base font-bold">{title}</Dialog.Title>
                  <Dialog.Close asChild>
                    <button type="button" aria-label={closeLabel} className={ICON_BUTTON}>
                      <X aria-hidden className="h-5 w-5" />
                    </button>
                  </Dialog.Close>
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-q-gutter py-5">{children}</div>
                {footer !== undefined ? <div className="shrink-0 border-t border-q-border px-q-gutter pb-6 pt-4">{footer}</div> : null}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  );
}

export interface MobileMenuSectionProps {
  title: string;
  children: ReactNode;
}

/** Kelompok tautan berjudul di dalam panel. */
export function MobileMenuSection({ title, children }: MobileMenuSectionProps): JSX.Element {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="m-0 px-2 pb-2 text-[13px] font-bold text-q-ink-soft">
        {title}
      </h2>
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0">{children}</ul>
    </section>
  );
}

export interface MobileMenuLinkProps {
  /** Tanpa href = baris redup tak bisa diklik (belum tersedia). */
  href?: string;
  children: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
  external?: boolean;
  /** Tautan ke halaman yang sedang dibuka: aria-current="page" + latar mint. */
  current?: boolean;
}

const ROW = 'flex min-h-11 items-center gap-3 rounded-q px-2 py-2 text-[15px]';

/** Satu baris tautan; memilihnya menutup panel. */
export function MobileMenuLink({ href, children, icon, badge, external, current = false }: MobileMenuLinkProps): JSX.Element {
  const body = (
    <>
      {icon !== undefined ? (
        <span aria-hidden className="shrink-0">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">{children}</span>
      {badge}
      {external === true ? (
        <>
          <ExternalLink aria-hidden className="h-4 w-4 shrink-0 text-q-ink-soft" />
          <span className="sr-only">{NAV.externalHint}</span>
        </>
      ) : null}
    </>
  );
  if (href === undefined) {
    return (
      <li>
        <div aria-disabled="true" className={cn(ROW, 'text-q-ink-soft')}>
          {body}
        </div>
      </li>
    );
  }
  return (
    <li>
      <Dialog.Close asChild>
        <a
          href={href}
          target={external === true ? '_blank' : undefined}
          rel={external === true ? 'noreferrer noopener' : undefined}
          aria-current={current ? 'page' : undefined}
          className={cn(ROW, 'font-bold text-q-ink no-underline transition-colors duration-150', current ? 'bg-q-tint' : 'hover:bg-q-muted')}
        >
          {body}
        </a>
      </Dialog.Close>
    </li>
  );
}

export interface MobileMenuNoteProps {
  icon?: ReactNode;
  children: ReactNode;
}

/** Keterangan pendek di dalam panel (bukan tautan). */
export function MobileMenuNote({ icon, children }: MobileMenuNoteProps): JSX.Element {
  return (
    <p className="m-0 flex items-start gap-2.5 px-2 text-[13px] leading-snug text-q-ink-soft">
      {icon !== undefined ? (
        <span aria-hidden className="mt-px shrink-0">
          {icon}
        </span>
      ) : null}
      <span>{children}</span>
    </p>
  );
}
