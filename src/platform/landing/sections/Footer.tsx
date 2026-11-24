/**
 * Bagian 14 — Footer: logo kecil + tautan GitHub, kolom "Jalur" (jalur yang belum tersedia tampil tanpa tautan dengan
 * chip "Segera"), dan kolom "Bantuan" (Cadangkan progres → layar Progres jalur; Pertanyaan umum → gulir ke FAQ).
 */
import { useId } from 'react';
import { ExternalLink } from 'lucide-react';
import { FOOTER, NAV, SOON_LABEL, TRACKS } from '../lib/content';
import { scrollToSection } from '../lib/scroll';
import { Icon } from '../ui/Icon';
import { Pill } from '../ui/Pill';
import { Container } from '../ui/Section';
import { Wordmark } from './navbar/Wordmark';

const LINK =
  'inline-flex min-h-9 items-center gap-2 rounded text-[15px] text-q-ink underline decoration-transparent underline-offset-4 transition-colors duration-150 hover:text-q-primary-ink hover:decoration-q-primary-ink/50';
const COLUMN_TITLE = 'm-0 text-sm font-bold text-q-ink-soft';

export function Footer(): JSX.Element {
  const tracksId = useId();
  const helpId = useId();
  return (
    <footer className="bg-q-footer text-q-ink" data-testid="home-footer">
      <Container className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)_minmax(0,3fr)] lg:gap-12 lg:py-14">
        <div className="flex flex-col items-start gap-4 sm:col-span-2 lg:col-span-1">
          <Wordmark size="sm" />
          <p className="m-0 max-w-[38ch] text-pretty text-[15px] leading-relaxed text-q-ink-soft">{FOOTER.tagline}</p>
          <a href={FOOTER.github.href} target="_blank" rel="noreferrer noopener" className={LINK} data-testid="footer-github">
            <Icon name="github" className="h-[18px] w-[18px]" />
            {FOOTER.github.label}
            <ExternalLink aria-hidden className="h-3.5 w-3.5 text-q-ink-soft" />
            <span className="sr-only">{NAV.externalHint}</span>
          </a>
        </div>

        <nav aria-labelledby={tracksId} className="flex flex-col gap-3">
          <h2 id={tracksId} className={COLUMN_TITLE}>
            {FOOTER.tracksTitle}
          </h2>
          <ul className="m-0 flex list-none flex-col p-0">
            {TRACKS.map((track) => (
              <li key={track.id}>
                {track.href !== undefined ? (
                  <a href={track.href} className={LINK}>
                    {track.title}
                  </a>
                ) : (
                  <span className="inline-flex min-h-9 flex-wrap items-center gap-x-2.5 gap-y-1 text-[15px] text-q-ink-soft">
                    {track.title}
                    <Pill size="sm" tone="soon">
                      {SOON_LABEL}
                    </Pill>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-labelledby={helpId} className="flex flex-col gap-3">
          <h2 id={helpId} className={COLUMN_TITLE}>
            {FOOTER.helpTitle}
          </h2>
          <ul className="m-0 flex list-none flex-col p-0">
            <li>
              <a href={FOOTER.help.backup.href} className={LINK} data-testid="home-backup-link">
                {FOOTER.help.backup.label}
              </a>
            </li>
            <li>
              <button type="button" onClick={() => scrollToSection(FOOTER.help.faq.sectionId)} className={LINK} data-testid="footer-faq">
                {FOOTER.help.faq.label}
              </button>
            </li>
          </ul>
        </nav>
      </Container>

      <div className="border-t border-q-border">
        <Container className="flex flex-col gap-1.5 py-5 text-[13px] leading-relaxed text-q-ink-soft sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <p className="m-0">{FOOTER.legal}</p>
          <p className="m-0">{FOOTER.dataNote}</p>
        </Container>
      </div>
    </footer>
  );
}
