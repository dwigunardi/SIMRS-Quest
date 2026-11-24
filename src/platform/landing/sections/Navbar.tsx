/**
 * Bagian 1 — Navbar: wordmark, menu Jalur / Fitur / Tentang, tombol utama, dan tombol tema. Menempel di atas saat
 * digulir. Di layar sempit menu pindah ke panel geser (hamburger); tombol utamanya ikut pindah ke dasar panel itu.
 */
import { useState, type MouseEvent } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useMotionValueEvent, useScroll } from 'framer-motion';
import { Pause, Play } from 'lucide-react';
import { PRODUCT_NAME } from '../../brand';
import { setMotionPaused, useMotionPaused, useSystemReducedMotion } from '../hooks/usePrefersReducedMotion';
import { cn } from '../lib/cn';
import { NAV, ROUTES, SOON_LABEL, TRACKS } from '../lib/content';
import { prefersReducedMotion } from '../lib/scroll';
import { Button3D } from '../ui/Button3D';
import { Icon } from '../ui/Icon';
import { MobileMenu, MobileMenuLink, MobileMenuNote, MobileMenuSection } from '../ui/MobileMenu';
import { NavDropdown, NavDropdownLink, NavDropdownNote, NavMenu } from '../ui/NavDropdown';
import { Pill } from '../ui/Pill';
import { Container } from '../ui/Section';
import { ThemeToggle } from '../ui/ThemeToggle';
import { CTA_LABEL, type HomeMode } from './Hero';
import { Wordmark } from './navbar/Wordmark';

export interface NavbarProps {
  /** Keadaan tombol utama — sama dengan hero: 'loading' = ringkasan belum siap (tombol belum ditampilkan). */
  mode: HomeMode;
  /** Tombol utama ("Mulai belajar" / "Lanjutkan" / "Buka jalur SQL") ditekan. */
  onStart: () => void;
}

/**
 * Jeda untuk semua gerak yang berjalan sendiri (pita berjalan, kata berganti, ayunan bola dunia, maskot, gelombang) —
 * WCAG 2.2.2: gerak otomatis lebih dari 5 detik harus bisa dihentikan tanpa bergantung pada pengaturan sistem.
 * Tidak ditampilkan bila sistem sudah meminta gerak dikurangi (tidak ada lagi yang bergerak sendiri).
 */
function MotionToggle(): JSX.Element | null {
  const paused = useMotionPaused();
  const systemReduced = useSystemReducedMotion();
  if (systemReduced) return null;
  const label = paused ? NAV.motion.resume : NAV.motion.pause;
  return (
    <button
      type="button"
      onClick={() => setMotionPaused(!paused)}
      aria-label={label}
      aria-pressed={paused}
      title={label}
      data-testid="motion-toggle"
      className="grid h-9 w-9 shrink-0 place-items-center rounded-q border border-q-border bg-q-surface text-q-ink transition-colors duration-150 hover:bg-q-muted"
    >
      {paused ? <Play aria-hidden className="h-4 w-4" /> : <Pause aria-hidden className="h-4 w-4" />}
    </button>
  );
}

const SOON_CHIP = (
  <Pill size="sm" tone="soon">
    {SOON_LABEL}
  </Pill>
);

function toTop(event: MouseEvent<HTMLAnchorElement>): void {
  // Sudah di Beranda: cukup kembali ke awal halaman, tanpa mengubah hash.
  event.preventDefault();
  window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

export function Navbar({ mode, onStart }: NavbarProps): JSX.Element {
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 8));

  // Label yang sama dengan tombol hero: semua misi tuntas → "Buka jalur SQL", bukan "Lanjutkan".
  const ctaLabel = CTA_LABEL[mode];
  const showCta = mode !== 'loading';

  return (
    <header className="sticky top-0 z-40 bg-q-bg/90 backdrop-blur-md">
      <Container className="flex h-q-nav items-center gap-2 sm:gap-3">
        <a href={ROUTES.home} onClick={toTop} aria-label={`${PRODUCT_NAME}: ${NAV.homeLabel}`} className="-ml-1 inline-flex h-10 shrink-0 items-center rounded-q px-1 no-underline">
          <Wordmark />
        </a>

        <NavMenu ariaLabel={NAV.ariaLabel} className="ml-3 hidden lg:block">
          <NavDropdown label={NAV.tracks.label} panelClassName="w-[380px]">
            {TRACKS.map((track) => (
              <NavDropdownLink
                key={track.id}
                href={track.href}
                title={track.title}
                description={track.tagline}
                icon={<Icon name={track.icon} />}
                badge={track.status === 'segera' ? SOON_CHIP : undefined}
              />
            ))}
          </NavDropdown>
          <NavDropdown label={NAV.features.label}>
            {NAV.features.items.map((item) => (
              <NavDropdownLink key={item.href} href={item.href} title={item.label} description={item.description} icon={<Icon name={item.icon} />} />
            ))}
          </NavDropdown>
          <NavDropdown label={NAV.about.label}>
            {NAV.about.items.map((item) => (
              <NavDropdownLink key={item.href} href={item.href} title={item.label} description={item.description} icon={<Icon name={item.icon} />} external={item.external} />
            ))}
            <NavDropdownNote icon={<Icon name={NAV.about.note.icon} className="h-4 w-4" />}>{NAV.about.note.text}</NavDropdownNote>
          </NavDropdown>
        </NavMenu>

        <div className="ml-auto flex items-center gap-2">
          {showCta ? (
            <Button3D size="sm" onClick={onStart} className="hidden sm:inline-flex" data-testid="nav-primary" data-mode={mode}>
              {ctaLabel}
            </Button3D>
          ) : null}
          <MotionToggle />
          <ThemeToggle />
          <MobileMenu
            title={NAV.mobile.title}
            openLabel={NAV.mobile.open}
            closeLabel={NAV.mobile.close}
            className="lg:hidden"
            footer={
              !showCta ? undefined : (
                <div className="pb-1">
                  <Dialog.Close asChild>
                    <Button3D fullWidth onClick={onStart} data-testid="nav-mobile-primary">
                      {ctaLabel}
                    </Button3D>
                  </Dialog.Close>
                </div>
              )
            }
          >
            <MobileMenuSection title={NAV.tracks.label}>
              {TRACKS.map((track) => (
                <MobileMenuLink key={track.id} href={track.href} icon={<Icon name={track.icon} />} badge={track.status === 'segera' ? SOON_CHIP : undefined}>
                  {track.title}
                </MobileMenuLink>
              ))}
            </MobileMenuSection>
            <MobileMenuSection title={NAV.features.label}>
              {NAV.features.items.map((item) => (
                <MobileMenuLink key={item.href} href={item.href} icon={<Icon name={item.icon} />}>
                  {item.label}
                </MobileMenuLink>
              ))}
            </MobileMenuSection>
            <MobileMenuSection title={NAV.about.label}>
              {NAV.about.items.map((item) => (
                <MobileMenuLink key={item.href} href={item.href} icon={<Icon name={item.icon} />} external={item.external}>
                  {item.label}
                </MobileMenuLink>
              ))}
            </MobileMenuSection>
            <MobileMenuNote icon={<Icon name={NAV.about.note.icon} className="h-4 w-4" />}>{NAV.about.note.text}</MobileMenuNote>
          </MobileMenu>
        </div>
      </Container>
      {/* Garis bawah baru muncul setelah halaman digulir. */}
      <div aria-hidden className={cn('q-anim absolute inset-x-0 bottom-0 h-px bg-q-border transition-opacity duration-200', scrolled ? 'opacity-100' : 'opacity-0')} />
    </header>
  );
}
