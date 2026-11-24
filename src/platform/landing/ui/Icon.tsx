import {
  AppWindow,
  ArrowLeftRight,
  Atom,
  Award,
  BookOpen,
  Braces,
  Bug,
  CalendarDays,
  ChartColumn,
  Check,
  ClipboardCheck,
  Crown,
  Database,
  Eye,
  FileDown,
  FileJson,
  Flame,
  Gauge,
  GitCompare,
  GitMerge,
  Github,
  Globe,
  HardDrive,
  KeyRound,
  Layers,
  Lightbulb,
  Medal,
  PencilRuler,
  Radar,
  Repeat,
  Rows3,
  Scale,
  ShieldAlert,
  Sigma,
  SquareStack,
  Swords,
  Table2,
  Tag,
  Terminal,
  Timer,
  Trophy,
  UserX,
  Workflow,
  Zap,
  type LucideIcon,
} from 'lucide-react';
// Impor per ikon (bukan dari indeks paket) supaya server dev tidak memuat ribuan logo.
import SiJavascript from '@icons-pack/react-simple-icons/icons/SiJavascript';
import SiLaravel from '@icons-pack/react-simple-icons/icons/SiLaravel';
import SiNestjs from '@icons-pack/react-simple-icons/icons/SiNestjs';
import SiNextdotjs from '@icons-pack/react-simple-icons/icons/SiNextdotjs';
import SiReact from '@icons-pack/react-simple-icons/icons/SiReact';
import SiTypescript from '@icons-pack/react-simple-icons/icons/SiTypescript';
import type { IconName } from '../lib/content';
import { cn } from '../lib/cn';

type BrandIconName = Extract<IconName, `si-${string}`>;
type LucideIconName = Exclude<IconName, BrandIconName>;

const LUCIDE: Record<LucideIconName, LucideIcon> = {
  database: Database,
  braces: Braces,
  globe: Globe,
  atom: Atom,
  layers: Layers,
  book: BookOpen,
  terminal: Terminal,
  'clipboard-check': ClipboardCheck,
  chart: ChartColumn,
  github: Github,
  scale: Scale,
  'hard-drive': HardDrive,
  tag: Tag,
  'user-x': UserX,
  'app-window': AppWindow,
  table: Table2,
  'git-merge': GitMerge,
  sigma: Sigma,
  'square-stack': SquareStack,
  workflow: Workflow,
  rows: Rows3,
  'arrow-left-right': ArrowLeftRight,
  gauge: Gauge,
  'shield-alert': ShieldAlert,
  'pencil-ruler': PencilRuler,
  'file-json': FileJson,
  calendar: CalendarDays,
  bug: Bug,
  eye: Eye,
  flame: Flame,
  medal: Medal,
  swords: Swords,
  award: Award,
  timer: Timer,
  repeat: Repeat,
  radar: Radar,
  'git-compare': GitCompare,
  lightbulb: Lightbulb,
  key: KeyRound,
  zap: Zap,
  'file-down': FileDown,
  trophy: Trophy,
  check: Check,
  crown: Crown,
};

const BRAND: Record<BrandIconName, typeof SiReact> = {
  'si-javascript': SiJavascript,
  'si-typescript': SiTypescript,
  'si-react': SiReact,
  'si-nestjs': SiNestjs,
  'si-nextdotjs': SiNextdotjs,
  'si-laravel': SiLaravel,
};

function isBrand(name: IconName): name is BrandIconName {
  return name.startsWith('si-');
}

export interface IconProps {
  /** Nama ikon dari lib/content.ts (IconName). */
  name: IconName;
  /** Ukuran lewat kelas (bawaan h-5 w-5). Warna mengikuti warna teks (currentColor). */
  className?: string;
}

/** Ikon landing berdasarkan nama. Selalu hiasan (aria-hidden): teks di sebelahnya yang memberi makna. */
export function Icon({ name, className }: IconProps): JSX.Element {
  const classes = cn('h-5 w-5 shrink-0', className);
  if (isBrand(name)) {
    const Brand = BRAND[name];
    return <Brand title="" aria-hidden focusable="false" className={classes} />;
  }
  const Lucide = LUCIDE[name];
  return <Lucide aria-hidden className={classes} />;
}
