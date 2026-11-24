/**
 * Bola dunia hero (cobe/WebGL) yang berpusat di Indonesia, dengan penanda berdenyut di kota-kota asal pasien pada
 * data latihan.
 *
 * - cobe (±5 KB) dimuat MALAS dan baru diinisialisasi saat bola dunia terlihat. Loop gambarnya (requestAnimationFrame)
 *   BERHENTI — bukan sekadar melewatkan frame — saat bola dunia keluar layar, tab disembunyikan, atau gambar diam
 *   sudah jadi; ia dibangunkan lagi saat keadaan itu berubah (lihat `wake`).
 * - Gerak: bola dunia berayun pelan di sekitar Indonesia (bukan berputar penuh, supaya penandanya selalu terlihat).
 *   Dengan reduced motion bola dunia digambar sekali lalu diam, dan penanda tidak berdenyut.
 * - Tanpa WebGL (atau sebelum cobe siap) tampil pengganti statis: bola SVG dengan garis lintang-bujur dan penanda.
 *
 * Bolanya menempati 80% tengah wadah (jari-jari 40% lebar); sisanya untuk pendar. Tepi atas bola = 10% dari atas wadah —
 * berguna untuk menaruh maskot yang mengintip.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useInView } from 'framer-motion';
import type { COBEOptions } from 'cobe';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { useTheme, type Theme } from '../hooks/useTheme';
import { cn } from '../lib/cn';

export interface GlobeMarker {
  name: string;
  lat: number;
  lon: number;
}

export interface GlobeProps {
  /** Kota yang ditandai (PATIENT_CITIES dari lib/content.ts). */
  markers: readonly GlobeMarker[];
  /** Titik yang menghadap penonton (GLOBE_FOCUS dari lib/content.ts). */
  focus: { lat: number; lon: number };
  /** Nama aksesibel (HERO.globeLabel). */
  label: string;
  /** Atur LEBAR di sini; wadahnya selalu persegi. */
  className?: string;
}

/* ------------------------------------------------------------------ */
/* Proyeksi (sama dengan rumus cobe, supaya penanda DOM tepat di atas penanda WebGL) */
/* ------------------------------------------------------------------ */

const GLOBE_RADIUS = 0.8;
const MARKER_ELEVATION = 0.02;
const DEG = Math.PI / 180;
/** Indonesia digeser sedikit ke bawah tengah supaya daratan Asia ikut terlihat. */
const TILT = 0.2;
/** Ayunan: ±0,3 rad, satu putaran bolak-balik 18 detik. */
const SWAY = 0.3;
const SWAY_PERIOD_MS = 18_000;

interface Projected {
  /** 0..1 dari kiri / atas wadah. */
  x: number;
  y: number;
  visible: boolean;
}

function project(lat: number, lon: number, phi: number, theta: number): Projected {
  const latRad = lat * DEG;
  const lonRad = lon * DEG - Math.PI;
  const cosLat = Math.cos(latRad);
  const r = GLOBE_RADIUS + MARKER_ELEVATION;
  const px = -cosLat * Math.cos(lonRad) * r;
  const py = Math.sin(latRad) * r;
  const pz = cosLat * Math.sin(lonRad) * r;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  const cosP = Math.cos(phi);
  const sinP = Math.sin(phi);
  const sx = cosP * px + sinP * pz;
  const sy = sinP * sinT * px + cosT * py - cosP * sinT * pz;
  const depth = -sinP * cosT * px + sinT * py + cosP * cosT * pz;
  return { x: (sx + 1) / 2, y: (-sy + 1) / 2, visible: depth >= 0 };
}

/** phi & theta yang membuat `focus` menghadap penonton. */
function facing(focus: { lat: number; lon: number }): { phi: number; theta: number } {
  return { phi: -Math.PI / 2 - focus.lon * DEG, theta: focus.lat * DEG + TILT };
}

type Rgb = [number, number, number];

function palette(theme: Theme): Pick<COBEOptions, 'dark' | 'baseColor' | 'glowColor' | 'markerColor' | 'mapBrightness' | 'mapBaseBrightness' | 'diffuse'> {
  const amber: Rgb = [0.96, 0.65, 0.14];
  if (theme === 'dark') {
    // Bola hampir hitam, daratan titik-titik zamrud.
    return { dark: 1, baseColor: [0.2, 0.86, 0.62], glowColor: [0.03, 0.2, 0.17], markerColor: amber, mapBrightness: 5, mapBaseBrightness: 0.04, diffuse: 1.2 };
  }
  // Bola mint pucat, daratan titik-titik hijau pinus.
  return { dark: 0, baseColor: [0.8, 0.95, 0.9], glowColor: [0.82, 0.95, 0.9], markerColor: amber, mapBrightness: 4, mapBaseBrightness: 0, diffuse: 1.1 };
}

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Komponen                                                            */
/* ------------------------------------------------------------------ */

type Mode = 'pending' | 'webgl' | 'static';

export function Globe({ markers, focus, label, className }: GlobeProps): JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const pinRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const seen = useInView(rootRef, { once: true, margin: '200px' });
  const onScreen = useInView(rootRef, { margin: '100px' });
  const reduced = usePrefersReducedMotion();
  const { theme } = useTheme();
  const [mode, setMode] = useState<Mode>('pending');

  const base = useMemo(() => facing(focus), [focus]);
  /** Posisi penanda saat diam (pengganti statis, dan posisi awal penanda DOM). */
  const resting = useMemo(() => markers.map((m) => project(m.lat, m.lon, base.phi, base.theta)), [markers, base]);

  // Nilai yang dibaca loop gambar tanpa membuat ulang bola dunia.
  const live = useRef({ onScreen, reduced, theme });
  live.current = { onScreen, reduced, theme };
  /** Menjadwalkan satu frame gambar bila loop sedang tidur (diisi setelah cobe siap). */
  const wake = useRef<(() => void) | null>(null);
  useEffect(() => {
    wake.current?.();
  }, [onScreen, reduced, theme]);

  useEffect(() => {
    if (!seen) return undefined;
    const host = hostRef.current;
    const root = rootRef.current;
    if (!host || !root) return undefined;
    if (!supportsWebGL()) {
      setMode('static');
      return undefined;
    }

    let cancelled = false;
    let frame = 0;
    let cleanup: (() => void) | null = null;

    void import('cobe')
      .then(({ default: createGlobe }) => {
        if (cancelled) return;
        // Kanvas dibuat sendiri (bukan lewat JSX): cobe memindahkan kanvas ke pembungkus buatannya, dan React tidak
        // boleh kehilangan jejak elemen miliknya.
        const canvas = document.createElement('canvas');
        canvas.style.cssText = 'width:100%;height:100%;display:block';
        canvas.setAttribute('aria-hidden', 'true');
        host.append(canvas);

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        let size = Math.max(1, root.clientWidth);
        let paintedTheme = live.current.theme;
        const globe = createGlobe(canvas, {
          width: size,
          height: size,
          devicePixelRatio: dpr,
          phi: base.phi,
          theta: base.theta,
          mapSamples: 16_000,
          scale: 1,
          offset: [0, 0],
          opacity: 1,
          markerElevation: MARKER_ELEVATION,
          markers: markers.map((m) => ({ location: [m.lat, m.lon], size: 0.035 })),
          ...palette(paintedTheme),
        });

        const placePins = (phi: number) => {
          markers.forEach((marker, index) => {
            const pin = pinRefs.current[index];
            if (!pin) return;
            const point = project(marker.lat, marker.lon, phi, base.theta);
            pin.style.transform = `translate(${(point.x * size).toFixed(2)}px, ${(point.y * size).toFixed(2)}px)`;
            pin.style.opacity = point.visible ? '1' : '0';
          });
        };

        const started = performance.now();
        let stillFrames = 0;
        let needsPaint = true;
        /** Minta satu frame; tidak menumpuk bila sudah ada yang terjadwal. */
        const schedule = () => {
          if (frame === 0 && !cancelled) frame = requestAnimationFrame(tick);
        };
        const tick = (now: number) => {
          frame = 0;
          const state = live.current;
          if (state.theme !== paintedTheme) {
            paintedTheme = state.theme;
            globe.update(palette(paintedTheme));
            needsPaint = true;
            stillFrames = 0;
          }
          // Tak terlihat: loop tidur sampai `wake` dipanggil (masuk layar lagi / tab kembali aktif).
          if (!state.onScreen || document.hidden) return;
          if (state.reduced) {
            // Diam: cukup beberapa frame (menunggu tekstur peta selesai dimuat), lalu loop tidur.
            if (!needsPaint && stillFrames > 30) return;
            needsPaint = false;
            stillFrames += 1;
            globe.update({ phi: base.phi });
            placePins(base.phi);
            schedule();
            return;
          }
          // Gerak diizinkan lagi setelah sempat diam: gambar diam berikutnya harus dimulai dari awal.
          stillFrames = 0;
          const phi = base.phi + Math.sin(((now - started) / SWAY_PERIOD_MS) * Math.PI * 2) * SWAY;
          globe.update({ phi });
          placePins(phi);
          schedule();
        };
        wake.current = schedule;
        document.addEventListener('visibilitychange', schedule);
        schedule();

        const resize = new ResizeObserver(() => {
          const next = Math.max(1, root.clientWidth);
          if (next === size) return;
          size = next;
          globe.update({ width: size, height: size });
          needsPaint = true;
          stillFrames = 0;
          schedule();
        });
        resize.observe(root);

        cleanup = () => {
          wake.current = null;
          document.removeEventListener('visibilitychange', schedule);
          resize.disconnect();
          globe.destroy();
          host.replaceChildren();
        };
        setMode('webgl');
      })
      .catch(() => {
        if (!cancelled) setMode('static');
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      cleanup?.();
    };
  }, [seen, markers, base]);

  const webgl = mode === 'webgl';

  return (
    <div ref={rootRef} role="img" aria-label={label} data-globe={mode} className={cn('relative aspect-square w-full select-none', className)}>
      {/* Pengganti statis: tampil sampai WebGL siap, dan seterusnya bila WebGL tidak ada. */}
      <svg aria-hidden focusable="false" viewBox="0 0 100 100" className={cn('absolute inset-0 h-full w-full transition-opacity duration-500 motion-reduce:transition-none', webgl ? 'opacity-0' : 'opacity-100')}>
        <circle cx={50} cy={50} r={40} className="fill-q-tint stroke-q-border" strokeWidth={0.6} />
        <g className="stroke-q-primary/25" fill="none" strokeWidth={0.5}>
          <ellipse cx={50} cy={50} rx={40} ry={13} />
          <ellipse cx={50} cy={50} rx={40} ry={28} />
          <ellipse cx={50} cy={50} rx={13} ry={40} />
          <ellipse cx={50} cy={50} rx={28} ry={40} />
          <line x1={10} y1={50} x2={90} y2={50} />
          <line x1={50} y1={10} x2={50} y2={90} />
        </g>
      </svg>

      <div ref={hostRef} className={cn('absolute inset-0 transition-opacity duration-700 motion-reduce:transition-none', webgl ? 'opacity-100' : 'opacity-0')} />

      {/* Penanda kota: titik amber + cincin berdenyut (denyut hanya bila gerak diizinkan). */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {markers.map((marker, index) => {
          const point = resting[index];
          return (
            <span
              key={marker.name}
              ref={(element) => {
                pinRefs.current[index] = element;
              }}
              className="absolute left-0 top-0 h-0 w-0 transition-opacity duration-300 motion-reduce:transition-none"
              style={webgl || !point ? undefined : { left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
            >
              <span
                className="q-loop absolute -left-2 -top-2 h-4 w-4 rounded-full border-2 border-q-amber-ink motion-safe:animate-ping"
                style={{ animationDelay: `${(index % 4) * 0.35}s`, animationDuration: '2.2s' }}
              />
              {/* Tepi amber-ink: amber polos hanya 2,03:1 di atas bola mint tema terang. */}
              <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full border border-q-amber-ink bg-q-amber" />
            </span>
          );
        })}
      </div>
    </div>
  );
}
