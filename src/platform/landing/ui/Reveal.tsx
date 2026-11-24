import { useMemo, type ReactNode } from 'react';
import { motion, type Variants } from 'framer-motion';
import { fadeUp, spring, stagger, viewportOnce } from '../lib/motion';

type RevealTag = 'div' | 'section' | 'li' | 'ul' | 'ol' | 'article' | 'header' | 'p' | 'span';

export interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Elemen yang dirender (bawaan div). */
  as?: RevealTag;
  /**
   * true = wadah: anak-anak <RevealItem> muncul bergiliran (jeda 0,08 dtk) saat wadah terlihat; wadahnya sendiri diam.
   * false (bawaan) = elemen ini sendiri muncul dari bawah.
   */
  group?: boolean;
  /** Jeda sebelum muncul (detik); hanya untuk group=false. */
  delay?: number;
  id?: string;
}

/**
 * Muncul sekali saat masuk layar (whileInView="show", viewport once + margin -80px): opacity 0→1, y 24→0.
 * Dengan reduced motion hanya opacity yang berubah (MotionConfig di LandingRoot).
 */
export function Reveal({ children, className, as = 'div', group = false, delay, id }: RevealProps): JSX.Element {
  const Tag = motion[as];
  const variants = useMemo<Variants>(() => {
    if (group) return stagger;
    if (delay === undefined) return fadeUp;
    return { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { ...spring, delay } } };
  }, [group, delay]);
  return (
    <Tag id={id} className={className} variants={variants} initial="hidden" whileInView="show" viewport={viewportOnce}>
      {children}
    </Tag>
  );
}

export interface RevealItemProps {
  children: ReactNode;
  className?: string;
  as?: RevealTag;
}

/** Anak dari <Reveal group>: ikut irama bergiliran induknya. Di luar <Reveal group> ia tidak beranimasi. */
export function RevealItem({ children, className, as = 'div' }: RevealItemProps): JSX.Element {
  const Tag = motion[as];
  return (
    <Tag className={className} variants={fadeUp}>
      {children}
    </Tag>
  );
}
