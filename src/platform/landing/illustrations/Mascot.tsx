/**
 * "Kapi" — maskot SIMRS Quest: kapsul obat dua warna (atas teal, bawah krem) yang ramah, bermata, dengan stetoskop
 * kecil. Karakter ORISINAL, digambar sebagai SVG sederhana; tidak meniru maskot mana pun.
 *
 * Warna badannya tetap di kedua tema (seperti stiker); hanya garis luar, lengan, dan kaki yang mengikuti tema
 * (--q-mascot-line: hijau pinus di tema terang, teal terang di tema gelap) supaya tetap terbaca.
 * Gerak: naik-turun halus + berkedip; keduanya berhenti saat reduced motion / dijeda, bila `animated={false}`, dan
 * selama maskotnya di luar layar atau tersembunyi (animasi berulang tidak boleh berjalan tanpa penonton).
 *
 * Mengintip dari balik benda bulat (bola dunia): render DUA kali di kotak yang sama —
 *   <Mascot pose="peek" part="body" />  di BELAKANG benda,  <Mascot pose="peek" part="hands" />  di DEPANNYA.
 * Untuk tepi lurus (kartu, jendela kode) cukup <Mascot pose="peek" /> yang diletakkan menumpang di tepi atasnya.
 */
import { useId, useRef } from 'react';
import { motion } from 'framer-motion';
import { useLoopMotion } from '../hooks/usePrefersReducedMotion';
import { cn } from '../lib/cn';

export type MascotPose =
  /** Berdiri, tangan di samping. */
  | 'idle'
  /** Melambai dengan tangan kanan. */
  | 'wave'
  /** Menunjuk ke kanan (ke isi di sebelahnya). */
  | 'point'
  /** Dua tangan terangkat. */
  | 'cheer'
  /** Hanya separuh atas, dua tangan memegang tepi: untuk mengintip dari balik sesuatu. */
  | 'peek';

export type MascotExpression = 'smile' | 'wink' | 'think' | 'wow';

export interface MascotProps {
  pose?: MascotPose;
  expression?: MascotExpression;
  /** Hanya untuk pose 'peek': gambar badan saja, tangan saja, atau keduanya (bawaan). */
  part?: 'all' | 'body' | 'hands';
  /** Lebar dalam px. Tanpa ini, atur lebar lewat className (tinggi mengikuti rasio; bawaan w-40). */
  size?: number;
  /** false = diam (tanpa naik-turun dan kedipan). */
  animated?: boolean;
  /** Nama aksesibel. Tanpa ini maskot dianggap hiasan (aria-hidden). */
  title?: string;
  /** Kelas pembungkus (posisi, lebar). Aman diberi kelas transform Tailwind — animasinya ada di elemen dalam. */
  className?: string;
}

const C = {
  top: '#14B8A6',
  bottom: '#FFFDF5',
  /** Garis di atas badan (wajah, sambungan, stetoskop): selalu gelap. */
  ink: '#134E4A',
  face: '#0B2F2C',
  blush: '#E5484D',
  amber: '#F5A623',
  amberLight: '#FFF3D6',
  /** Garis luar, lengan, kaki: ikut tema. */
  line: 'rgb(var(--q-mascot-line))',
} as const;

/** Tinggi viewBox pose mengintip; badan dipotong di PEEK_CUT, tangan menutup potongannya. */
const PEEK_HEIGHT = 136;
const PEEK_CUT = 124;

interface Arm {
  path: string;
  hand: readonly [number, number];
}

const ARMS: Record<Exclude<MascotPose, 'peek'>, { left: Arm; right: Arm }> = {
  idle: {
    left: { path: 'M58 134 Q38 146 41 166', hand: [41, 169] },
    right: { path: 'M142 134 Q162 146 159 166', hand: [159, 169] },
  },
  wave: {
    left: { path: 'M58 134 Q38 146 41 166', hand: [41, 169] },
    right: { path: 'M142 130 Q170 120 174 94', hand: [175, 90] },
  },
  point: {
    left: { path: 'M58 134 Q38 146 41 166', hand: [41, 169] },
    right: { path: 'M142 132 Q164 132 184 120', hand: [187, 118] },
  },
  cheer: {
    left: { path: 'M58 130 Q30 120 26 94', hand: [25, 90] },
    right: { path: 'M142 130 Q170 120 174 94', hand: [175, 90] },
  },
};

function Mouth({ expression }: { expression: MascotExpression }): JSX.Element {
  if (expression === 'wow') return <ellipse cx={100} cy={99} rx={5.5} ry={6.5} fill={C.face} />;
  const d = expression === 'think' ? 'M93 99 Q100 96 108 99' : expression === 'wink' ? 'M88 93 Q100 108 112 93' : 'M90 94 Q100 104 110 94';
  return <path d={d} fill="none" stroke={C.face} strokeWidth={4} strokeLinecap="round" />;
}

function Face({ expression, blink }: { expression: MascotExpression; blink: boolean }): JSX.Element {
  const big = expression === 'wow';
  const eye = (cx: number) => (
    <>
      <ellipse cx={cx} cy={78} rx={big ? 7.5 : 6.5} ry={big ? 10 : 8.5} fill={C.face} />
      <circle cx={cx + (expression === 'think' ? 2.6 : 2)} cy={expression === 'think' ? 73 : 74.5} r={2.3} fill="#FFFFFF" />
    </>
  );
  return (
    <g>
      <circle cx={71} cy={93} r={7} fill={C.blush} opacity={0.32} />
      <circle cx={129} cy={93} r={7} fill={C.blush} opacity={0.32} />
      {/* Mata: berkedip = memipih sesaat (scaleY), tiap ±4 detik */}
      <motion.g
        animate={blink ? { scaleY: [1, 1, 0.1, 1] } : { scaleY: 1 }}
        transition={blink ? { duration: 4.2, times: [0, 0.93, 0.965, 1], repeat: Infinity, ease: 'easeInOut' } : LOOP_STOP}
      >
        {eye(84)}
        {expression === 'wink' ? <path d="M109 80 Q116 72 123 80" fill="none" stroke={C.face} strokeWidth={4} strokeLinecap="round" /> : eye(116)}
      </motion.g>
      {expression === 'think' ? <path d="M108 61 L124 57" stroke={C.face} strokeWidth={3.5} strokeLinecap="round" /> : null}
      <Mouth expression={expression} />
    </g>
  );
}

function ArmShape({ arm }: { arm: Arm }): JSX.Element {
  return (
    <>
      <path d={arm.path} fill="none" stroke={C.line} strokeWidth={7} strokeLinecap="round" />
      <circle cx={arm.hand[0]} cy={arm.hand[1]} r={8.5} fill={C.bottom} stroke={C.line} strokeWidth={4} />
    </>
  );
}

/**
 * Keadaan diam sebuah animasi berulang. Nilainya ditulis EKSPLISIT (bukan `animate={undefined}`): bila `animate`
 * dikosongkan, framer-motion menganimasikan nilai kembali ke awal dengan transition lama (repeat: Infinity) sehingga
 * geraknya tidak pernah berhenti.
 */
const LOOP_STOP = { duration: 0 } as const;

export function Mascot({ pose = 'idle', expression = 'smile', part = 'all', size, animated = true, title, className }: MascotProps): JSX.Element {
  const clipId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const moving = useLoopMotion(rootRef, animated);
  const peek = pose === 'peek';
  const arms = peek ? null : ARMS[pose];
  const showBody = !peek || part !== 'hands';
  const showHands = peek && part !== 'body';
  const bodyBottom = peek ? PEEK_CUT : 208;

  return (
    <span
      ref={rootRef}
      role={title !== undefined ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title === undefined ? true : undefined}
      className={cn('inline-block', size === undefined ? 'w-40' : '', className)}
      style={size !== undefined ? { width: size } : undefined}
    >
      <motion.svg
        viewBox={peek ? `0 0 200 ${PEEK_HEIGHT}` : '0 0 200 240'}
        aria-hidden
        focusable="false"
        className="block h-auto w-full overflow-visible"
        animate={moving ? { y: [0, -6, 0] } : { y: 0 }}
        transition={moving ? { duration: 3.4, repeat: Infinity, ease: 'easeInOut' } : LOOP_STOP}
      >
        <defs>
          <clipPath id={clipId}>
            {peek ? <path d={`M52 ${PEEK_CUT} V66 A48 48 0 0 1 148 66 V${PEEK_CUT} Z`} /> : <rect x={52} y={18} width={96} height={190} rx={48} />}
          </clipPath>
        </defs>

        {arms ? (
          <>
            <ellipse cx={100} cy={228} rx={46} ry={7} fill="#000000" opacity={0.12} />
            <ellipse cx={82} cy={210} rx={14} ry={8} fill={C.line} />
            <ellipse cx={118} cy={210} rx={14} ry={8} fill={C.line} />
            <ArmShape arm={arms.left} />
            {pose === 'wave' ? (
              // Lambaian: lengan kanan berayun di bahu.
              <motion.g
                style={{ transformBox: 'view-box', originX: '142px', originY: '130px' }}
                animate={moving ? { rotate: [0, 14, -6, 14, 0] } : { rotate: 0 }}
                transition={moving ? { duration: 1.6, repeat: Infinity, repeatDelay: 1.4, ease: 'easeInOut' } : LOOP_STOP}
              >
                <ArmShape arm={arms.right} />
              </motion.g>
            ) : (
              <ArmShape arm={arms.right} />
            )}
          </>
        ) : null}

        {showBody ? (
          <>
            {/* Badan kapsul: atas teal, bawah krem */}
            <g clipPath={`url(#${clipId})`}>
              <rect x={52} y={18} width={96} height={98} fill={C.top} />
              <rect x={52} y={116} width={96} height={92} fill={C.bottom} />
              <rect x={126} y={18} width={22} height={190} fill={C.ink} opacity={0.1} />
              <path d="M70 42 q-7 14 -7 36" fill="none" stroke="#FFFFFF" strokeWidth={7} strokeLinecap="round" opacity={0.45} />
            </g>
            {peek ? (
              <path d={`M52 ${bodyBottom} V66 A48 48 0 0 1 148 66 V${bodyBottom}`} fill="none" stroke={C.line} strokeWidth={5} />
            ) : (
              <rect x={52} y={18} width={96} height={190} rx={48} fill="none" stroke={C.line} strokeWidth={5} />
            )}
            <line x1={54.5} y1={116} x2={145.5} y2={116} stroke={C.ink} strokeWidth={4} />
            <Face expression={expression} blink={moving} />
          </>
        ) : null}

        {showHands ? (
          // Mengintip: dua tangan memegang tepi.
          <>
            <rect x={54} y={112} width={32} height={22} rx={11} fill={C.bottom} stroke={C.line} strokeWidth={4} />
            <rect x={114} y={112} width={32} height={22} rx={11} fill={C.bottom} stroke={C.line} strokeWidth={4} />
          </>
        ) : null}

        {!peek ? (
          // Stetoskop: selang menggantung di "leher" + kepala stetoskop amber.
          <>
            <path d="M66 122 C66 168, 134 168, 134 122" fill="none" stroke={C.ink} strokeWidth={4.5} strokeLinecap="round" />
            <circle cx={66} cy={121} r={4.5} fill={C.ink} />
            <circle cx={134} cy={121} r={4.5} fill={C.ink} />
            <path d="M100 156 V166" stroke={C.ink} strokeWidth={4.5} strokeLinecap="round" />
            <circle cx={100} cy={176} r={10} fill={C.amber} stroke={C.ink} strokeWidth={4} />
            <circle cx={100} cy={176} r={3.6} fill={C.amberLight} />
          </>
        ) : null}
      </motion.svg>
    </span>
  );
}
