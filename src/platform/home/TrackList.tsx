/**
 * "Jalur belajar": jalur yang tersedia sebagai kartu (dengan kemajuan bila sudah mulai), lalu jalur yang akan datang
 * sebagai baris ringkas. Baris 'segera' adalah tombol yang membuka/menutup deskripsinya di tempat — tidak ke mana-mana.
 */
import { useState } from 'react';
import { ArrowRight, ChevronDown } from 'lucide-react';
import type { TrackGlance, TrackManifest } from '../tracks';
import { BTN_SECONDARY, FOCUS_RING, SECTION_TITLE } from './ui';

export interface TrackListProps {
  tracks: readonly TrackManifest[];
  /** Jalur yang ringkasannya dimiliki Beranda (untuk baris kemajuan), bila sudah siap. */
  glanceTrackId: string | undefined;
  glance: TrackGlance | null;
  onOpen: (track: TrackManifest) => void;
}

export function TrackList({ tracks, glanceTrackId, glance, onOpen }: TrackListProps): JSX.Element {
  const available = tracks.filter((t) => t.status === 'tersedia');
  const upcoming = tracks.filter((t) => t.status === 'segera');
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section aria-labelledby="home-tracks-title" data-testid="home-tracks">
      <h2 id="home-tracks-title" className={SECTION_TITLE}>
        Jalur belajar
      </h2>
      <div className="mt-3 flex flex-col gap-3">
        {available.map((track) => (
          <AvailableTrack key={track.id} track={track} glance={track.id === glanceTrackId ? glance : null} onOpen={() => onOpen(track)} />
        ))}
        {upcoming.length > 0 ? (
          <ul className="divide-y divide-slate-800 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/30">
            {upcoming.map((track) => (
              <UpcomingTrack key={track.id} track={track} open={openId === track.id} onToggle={() => setOpenId((prev) => (prev === track.id ? null : track.id))} />
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

function AvailableTrack({ track, glance, onOpen }: { track: TrackManifest; glance: TrackGlance | null; onOpen: () => void }): JSX.Element {
  const Icon = track.icon;
  const started = glance?.started === true;
  const percent = glance && glance.total > 0 ? Math.round((glance.completed / glance.total) * 100) : 0;

  return (
    // Grid, bukan flex: di layar sempit isi kartu memakai lebar penuh dan tombolnya turun ke dasar kartu; di layar lebar
    // tombol yang SAMA (satu elemen, urutan Tab tetap) naik ke pojok kanan atas dan isi sejajar dengan judul.
    <article
      className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-x-4 sm:p-5"
      data-testid="home-track"
      data-track={track.id}
      data-status={track.status}
    >
      <span className={`grid h-11 w-11 place-items-center rounded-xl border ${track.accent.border} ${track.accent.bg} ${track.accent.text}`} aria-hidden>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 self-center">
        <h3 className="text-base font-semibold text-slate-100">{track.title}</h3>
        <p className="text-sm text-slate-400">{track.tagline}</p>
      </div>
      <div className="col-span-2 mt-3 min-w-0 sm:col-start-2">
        <p className="text-sm leading-relaxed text-slate-300">{track.description}</p>
        <p className="mt-3 text-xs font-medium text-slate-400" data-testid="home-track-meta">
          {track.meta.join(' · ')}
        </p>
        {started && glance ? (
          <div className="mt-3 flex items-center gap-3" data-testid="home-track-progress">
            <div
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800"
              role="progressbar"
              aria-label={`Kemajuan jalur ${track.title}`}
              aria-valuemin={0}
              aria-valuemax={glance.total}
              aria-valuenow={glance.completed}
              aria-valuetext={`${glance.completed} dari ${glance.total} misi selesai`}
            >
              <div className="h-full rounded-full bg-emerald-400" style={{ width: `${percent}%` }} />
            </div>
            <span className="shrink-0 text-xs tabular-nums text-slate-400">
              {glance.completed}/{glance.total} misi
            </span>
          </div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onOpen}
        className={`${BTN_SECONDARY} col-span-2 mt-4 sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:mt-0 sm:self-center`}
        data-testid="home-track-open"
        aria-label={`${started ? 'Buka' : 'Mulai'} jalur ${track.title}`}
      >
        {started ? 'Buka' : 'Mulai'}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </button>
    </article>
  );
}

function UpcomingTrack({ track, open, onToggle }: { track: TrackManifest; open: boolean; onToggle: () => void }): JSX.Element {
  const Icon = track.icon;
  const panelId = `home-track-${track.id}-detail`;

  return (
    <li data-testid="home-track" data-track={track.id} data-status={track.status}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-800/40 focus-visible:-outline-offset-2 ${FOCUS_RING}`}
      >
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border ${track.accent.border} ${track.accent.bg} ${track.accent.text}`} aria-hidden>
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-200">{track.title}</span>
          <span className="block text-sm text-slate-400">{track.tagline}</span>
        </span>
        <span className="shrink-0 rounded-full border border-slate-700 bg-slate-800/70 px-2 py-0.5 text-xs font-medium text-slate-300">Segera</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {/* Panel selalu ada di DOM (aria-controls harus menunjuk elemen nyata); isinya tersembunyi saat tertutup. */}
      <div id={panelId} hidden={!open} className="px-4 pb-4 pl-16">
        <p className="text-sm leading-relaxed text-slate-300">{track.description}</p>
        <p className="mt-2 text-xs font-medium text-slate-400">{track.meta.join(' · ')} · belum bisa dibuka</p>
      </div>
    </li>
  );
}
