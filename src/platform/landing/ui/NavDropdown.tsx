/**
 * Menu navbar desktop (Radix NavigationMenu): tombol berlabel yang membuka panel berisi tautan. Bisa dibuka dengan
 * sorotan mouse, klik, atau keyboard (Enter/Spasi/panah bawah; Esc menutup).
 *
 *   <NavMenu ariaLabel={NAV.ariaLabel}>
 *     <NavDropdown label="Jalur">
 *       <NavDropdownLink href="#/sql" icon={<Icon name="database" />} title="SQL" description="…" />
 *       <NavDropdownLink icon={…} title="React" description="…" badge={<Pill size="sm" tone="soon">Segera</Pill>} />  ← tanpa href = belum tersedia
 *       <NavDropdownNote icon={…}>Data tersimpan di browser ini.</NavDropdownNote>
 *     </NavDropdown>
 *   </NavMenu>
 */
import type { ReactNode } from 'react';
import * as NavigationMenu from '@radix-ui/react-navigation-menu';
import { ChevronDown, ExternalLink } from 'lucide-react';
import { NAV } from '../lib/content';
import { cn } from '../lib/cn';

export interface NavMenuProps {
  ariaLabel: string;
  children: ReactNode;
  className?: string;
}

/** Pembungkus menu: <nav> + daftar. Isinya <NavDropdown> dan/atau <NavLink>. */
export function NavMenu({ ariaLabel, children, className }: NavMenuProps): JSX.Element {
  return (
    <NavigationMenu.Root aria-label={ariaLabel} delayDuration={80} className={cn('relative z-20', className)}>
      <NavigationMenu.List className="m-0 flex list-none items-center gap-1 p-0">{children}</NavigationMenu.List>
    </NavigationMenu.Root>
  );
}

const TOP_ITEM =
  'group inline-flex h-9 items-center gap-1 rounded-q px-3 font-q-body text-sm font-bold text-q-ink transition-colors duration-150 hover:bg-q-muted data-[state=open]:bg-q-muted';

export interface NavDropdownProps {
  label: string;
  children: ReactNode;
  /** Sisi panel yang rata dengan tombolnya. */
  align?: 'start' | 'end';
  /** Kelas lebar panel (bawaan w-[340px]). */
  panelClassName?: string;
}

export function NavDropdown({ label, children, align = 'start', panelClassName }: NavDropdownProps): JSX.Element {
  return (
    <NavigationMenu.Item className="relative">
      <NavigationMenu.Trigger className={TOP_ITEM}>
        {label}
        <ChevronDown aria-hidden className="h-4 w-4 text-q-ink-soft transition-transform duration-200 group-data-[state=open]:rotate-180 motion-reduce:transition-none" />
      </NavigationMenu.Trigger>
      <NavigationMenu.Content
        className={cn(
          'q-anim absolute top-full z-30 mt-2 w-[340px] max-w-[calc(100vw-40px)] rounded-q border border-q-border bg-q-surface p-2 text-q-ink shadow-q-pop',
          'data-[state=closed]:animate-q-menu-out data-[state=open]:animate-q-menu-in',
          align === 'start' ? 'left-0 origin-top-left' : 'right-0 origin-top-right',
          panelClassName,
        )}
      >
        <ul className="m-0 flex list-none flex-col gap-0.5 p-0">{children}</ul>
      </NavigationMenu.Content>
    </NavigationMenu.Item>
  );
}

export interface NavDropdownLinkProps {
  /** Tanpa href = baris tak bisa diklik (mis. jalur yang belum tersedia). */
  href?: string;
  title: string;
  description?: string;
  /** Ikon di kiri (hiasan). */
  icon?: ReactNode;
  /** Mis. chip "Segera". */
  badge?: ReactNode;
  /** Tautan keluar aplikasi: dibuka di tab baru. */
  external?: boolean;
}

function RowBody({ title, description, icon, badge, external, muted }: NavDropdownLinkProps & { muted: boolean }): JSX.Element {
  return (
    <>
      {icon !== undefined ? (
        <span aria-hidden className={cn('mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-q', muted ? 'bg-q-muted text-q-ink-soft' : 'bg-q-tint text-q-primary-ink')}>
          {icon}
        </span>
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2">
          <span className={cn('text-sm font-bold', muted ? 'text-q-ink-soft' : 'text-q-ink')}>{title}</span>
          {badge}
          {external === true ? (
            <>
              <ExternalLink aria-hidden className="h-3.5 w-3.5 text-q-ink-soft" />
              <span className="sr-only">{NAV.externalHint}</span>
            </>
          ) : null}
        </span>
        {description !== undefined ? <span className="text-[13px] leading-snug text-q-ink-soft">{description}</span> : null}
      </span>
    </>
  );
}

/** Satu baris di panel menu: tautan (dengan href) atau baris redup tanpa tautan (tanpa href). */
export function NavDropdownLink(props: NavDropdownLinkProps): JSX.Element {
  const { href, external } = props;
  if (href === undefined) {
    return (
      <li>
        <div aria-disabled="true" className="flex items-start gap-3 rounded-q p-2.5">
          <RowBody {...props} muted />
        </div>
      </li>
    );
  }
  return (
    <li>
      <NavigationMenu.Link asChild>
        <a
          href={href}
          target={external === true ? '_blank' : undefined}
          rel={external === true ? 'noreferrer noopener' : undefined}
          className="flex items-start gap-3 rounded-q p-2.5 no-underline transition-colors duration-150 hover:bg-q-muted"
        >
          <RowBody {...props} muted={false} />
        </a>
      </NavigationMenu.Link>
    </li>
  );
}

export interface NavDropdownNoteProps {
  icon?: ReactNode;
  children: ReactNode;
}

/** Baris keterangan di dasar panel (bukan tautan). */
export function NavDropdownNote({ icon, children }: NavDropdownNoteProps): JSX.Element {
  return (
    <li className="mt-1 flex items-start gap-2.5 border-t border-q-border px-2.5 pb-1.5 pt-3 text-[13px] leading-snug text-q-ink-soft">
      {icon !== undefined ? (
        <span aria-hidden className="mt-px shrink-0">
          {icon}
        </span>
      ) : null}
      <span>{children}</span>
    </li>
  );
}

export interface NavLinkProps {
  href: string;
  children: ReactNode;
  external?: boolean;
}

/** Tautan langsung di tingkat atas navbar (tanpa panel). */
export function NavLink({ href, children, external }: NavLinkProps): JSX.Element {
  return (
    <NavigationMenu.Item>
      <NavigationMenu.Link asChild>
        <a href={href} target={external === true ? '_blank' : undefined} rel={external === true ? 'noreferrer noopener' : undefined} className={cn(TOP_ITEM, 'no-underline')}>
          {children}
        </a>
      </NavigationMenu.Link>
    </NavigationMenu.Item>
  );
}
