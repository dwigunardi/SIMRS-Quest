/**
 * Panggung kanan hero landing jalur (C1). Satu komposisi untuk kedua varian, dirakit dari data jalur:
 *
 *   'tersedia': kartu logo besar dengan Kapi mengintip dari tepi atasnya, jendela kode yang mengetik query misi
 *               SUNGGUHAN (`hero.glimpse` — misi Tier 1 di aplikasi), lalu penilaiannya ("Jawaban benar!" + XP) muncul
 *               di sudut jendela. Satu momen gerak: kode diketik → penilaian muncul.
 *   'segera'  : kartu logo dengan Kapi berpikir dan kartu bergaris putus-putus berisi tiga topik pertama rencana materi,
 *               bertanda "Rencana" — bahasa visual yang sama dengan pill "Segera".
 *
 * Layar lebar: kartu-kartu disusun bertumpuk (kode di kiri bawah, logo di kanan atas) dan melayang pelan dengan parallax
 * ringan. Di bawah lg: satu baris di bawah teks — logo kecil di samping jendela kode / kartu rencana, tanpa Kapi.
 *
 * Aksesibilitas: hanya kartu logo yang bernama (role="img"); jendela kode, penilaian, dan kartu rencana adalah hiasan
 * (aria-hidden) — isinya sama dengan bagian halaman di bawahnya (baris "Jalankan query", "Rencana materi"). Gerak
 * melayang (q-float, LogoCard) berhenti saat gerak dikurangi dan saat "Jeda animasi".
 */
import { useState, type CSSProperties } from 'react';
import { AnimatePresence, motion, useScroll, useTransform } from 'framer-motion';
import { Check } from 'lucide-react';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { Mascot } from '../illustrations/Mascot';
import { cn } from '../lib/cn';
import { COURSE_UI } from '../lib/pagesContent';
import type { CourseData, HeroGlimpse, SoonCourse } from '../courses/types';
import { CodeWindow } from '../ui/CodeWindow';
import { Icon } from '../ui/Icon';
import { LogoCard } from '../ui/LogoCard';
import { Pill } from '../ui/Pill';

/** Kartu kedua melayang dengan tempo & fase berbeda dari kartu logo (6 dtk) supaya tidak naik-turun serempak. */
const SECOND_FLOAT: CSSProperties = { animationDuration: '7s', animationDelay: '-2.5s' };
/** Banyak topik rencana di kartu panggung jalur 'segera'. */
const PLAN_PREVIEW = 3;

export function HeroStage({ course }: { course: CourseData }): JSX.Element {
  const reduced = usePrefersReducedMotion();
  const { scrollY } = useScroll();
  const sideY = useTransform(scrollY, [0, 700], [0, -56]);
  const label = COURSE_UI.heroCardLabel(course.title);
  const soon = course.status === 'segera';
  const back = soon ? 'border-2 border-dashed border-q-border-strong/60 bg-q-surface/40' : 'bg-q-primary/15';

  return (
    <div className="relative mx-auto flex w-full max-w-[520px] items-center justify-center gap-5 sm:gap-8 lg:block lg:h-[452px] lg:max-w-[500px]" data-testid="course-hero-card">
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-q-primary/10 blur-2xl sm:h-72 sm:w-72 lg:left-auto lg:right-0 lg:top-4 lg:h-[380px] lg:w-[380px] lg:translate-x-0 lg:translate-y-0"
      />

      {/* Kartu logo: kecil (di samping kartu kedua) di bawah lg, besar + Kapi + parallax mulai lg. */}
      <div className="relative shrink-0 lg:hidden">
        <span aria-hidden className={cn('absolute inset-0 translate-x-2 translate-y-1.5 rotate-[5deg] rounded-[24px]', back)} />
        <LogoCard icons={course.hero.logos} size="md" tilt={-3} label={label} />
      </div>
      <div className="absolute right-2 top-[70px] hidden lg:block">
        <span aria-hidden className={cn('absolute inset-0 translate-x-5 translate-y-3 rotate-[6deg] rounded-[40px]', back)} />
        <LogoCard icons={course.hero.logos} size="xl" tilt={-3} parallax={36} label={label}>
          <Mascot pose="peek" expression={soon ? 'think' : 'wink'} className="absolute left-1/2 top-0 z-10 w-[118px] -translate-x-1/2 -translate-y-[86%]" />
        </LogoCard>
      </div>

      <motion.div style={reduced ? undefined : { y: sideY }} className="relative z-20 min-w-0 flex-1 sm:max-w-[290px] lg:absolute lg:bottom-6 lg:left-0 lg:w-[284px] lg:max-w-none lg:flex-none">
        <div data-float="" className="q-float" style={SECOND_FLOAT}>
          {course.status === 'tersedia' && course.hero.glimpse ? <MissionGlimpse glimpse={course.hero.glimpse} /> : null}
          {course.status === 'segera' ? <PlanGlimpse course={course} /> : null}
        </div>
      </motion.div>
    </div>
  );
}

/** Jendela kode yang mengetik query misi, lalu penilaian aplikasi muncul di sudut kanan bawahnya. */
function MissionGlimpse({ glimpse }: { glimpse: HeroGlimpse }): JSX.Element {
  const [typed, setTyped] = useState(false);
  return (
    <div aria-hidden className="relative pb-4">
      <CodeWindow
        code={glimpse.code}
        fileName={glimpse.fileName}
        typing
        typingSpeed={24}
        typingDelay={350}
        onTyped={() => setTyped(true)}
        showLineNumbers={false}
        titleRight={<span className="hidden whitespace-nowrap text-[11px] font-bold text-q-code-muted sm:inline">{glimpse.label}</span>}
        className="rounded-q"
      />
      <AnimatePresence>
        {typed ? (
          <motion.p
            initial={{ opacity: 0, scale: 0.85, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 24 }}
            className="absolute -bottom-1 right-2 m-0 inline-flex items-center gap-2 whitespace-nowrap rounded-q-pill border border-q-border bg-q-surface py-1.5 pl-1.5 pr-3 text-[13px] font-bold text-q-ink shadow-q-pop lg:-right-6"
            data-testid="course-hero-verdict"
          >
            <span className="grid h-6 w-6 place-items-center rounded-full bg-q-success text-q-on-success">
              <Check className="h-3.5 w-3.5" strokeWidth={3.5} />
            </span>
            {glimpse.verdict}
            <span className="rounded-q-pill bg-q-amber-soft px-2 py-0.5 text-xs text-q-amber-ink">{glimpse.xp}</span>
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** Kartu bergaris putus-putus: tiga topik pertama rencana materi, bertanda "Rencana" (isi lengkap di section Rencana). */
function PlanGlimpse({ course }: { course: SoonCourse }): JSX.Element {
  const { plan } = course;
  return (
    <div aria-hidden className="rounded-q-lg border-2 border-dashed border-q-border-strong bg-q-surface p-4 shadow-q-float">
      <p className="m-0 flex items-center justify-between gap-3">
        <span className="text-[13px] font-bold text-q-ink">{plan.title}</span>
        <Pill size="sm" tone="soon" className="font-bold">
          {plan.badge}
        </Pill>
      </p>
      <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
        {plan.topics.slice(0, PLAN_PREVIEW).map((topic) => (
          <li key={topic.title} className="flex items-center gap-2.5 text-[13px] leading-snug text-q-ink-soft">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-q bg-q-muted text-q-ink-soft">
              <Icon name={topic.icon} className="h-4 w-4" />
            </span>
            <span className="min-w-0">{topic.title}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
