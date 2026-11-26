/**
 * C6c — "Belajar di mana saja": ponsel berisi daftar tier jalur (judul tier asli dari silabus) + chip kemajuan, dan
 * kartu mengambang "Tanpa instalasi". Tidak ada lencana toko aplikasi: aplikasi ini murni web.
 *
 * Angka di ponsel = progres di browser ini (hanya dibaca): misi selesai per tier dan "n dari 72 misi selesai"; tanpa
 * progres semuanya 0 — memang begitu keadaannya. Kartu mengambang memakai kelas q-float (berhenti saat gerak dikurangi
 * dan saat "Jeda animasi").
 */
import { Zap } from 'lucide-react';
import { PRODUCT_NAME } from '../../../../brand';
import type { CourseProgress } from '../../../courses/progress';
import type { AvailableCourse } from '../../../courses/types';
import { cn } from '../../../lib/cn';
import { Icon } from '../../../ui/Icon';
import { PhoneMockup } from '../../../ui/Mockups';
import { FeatureRow } from './FeatureRow';

function PhoneScreen({ course, progress }: { course: AvailableCourse; progress: CourseProgress }): JSX.Element {
  const total = course.syllabus.tiers.reduce((sum, tier) => sum + tier.missions.length, 0);
  const completed = progress.completed;
  const ratio = total > 0 ? completed / total : 0;
  return (
    <div aria-hidden className="relative flex h-full w-full flex-col bg-slate-950 px-3 pb-3 pt-12 font-sans text-slate-200">
      <div className="flex items-center justify-between gap-2 px-1">
        <span className="truncate text-[13px] font-bold tracking-tight text-slate-100">{PRODUCT_NAME}</span>
        <span className="shrink-0 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-emerald-300">
          {course.title}
        </span>
      </div>
      <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
        <p className="text-[11px] font-semibold text-emerald-300">{course.syllabus.progress(completed, total)}</p>
        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-slate-800">
          <span className="block h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" style={{ width: `${Math.max(ratio * 100, 2)}%` }} />
        </span>
      </div>
      <ul className="mt-3 flex list-none flex-col gap-1.5 p-0">
        {course.syllabus.tiers.map((tier) => {
          const done = tier.missions.filter((mission) => progress.completedIds.has(mission.id)).length;
          const all = done === tier.missions.length && done > 0;
          return (
            <li key={tier.value} className="flex items-center gap-2.5 rounded-lg border border-slate-800/80 bg-slate-900/40 px-2.5 py-2">
              <span
                className={cn(
                  'grid h-6 w-6 shrink-0 place-items-center rounded-md text-[11px] font-bold',
                  all ? 'bg-emerald-500 text-emerald-950' : done > 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400',
                )}
              >
                {tier.tier}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[12px] font-semibold text-slate-200" data-phone-text="">{tier.title}</span>
                  <span className="shrink-0 text-[10px] tabular-nums text-slate-400" data-phone-text="">
                    {done}/{tier.missions.length}
                  </span>
                </span>
                <span className="mt-1 block h-1 overflow-hidden rounded-full bg-slate-800">
                  <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${(done / Math.max(tier.missions.length, 1)) * 100}%` }} />
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      <span className="pointer-events-none absolute inset-x-0 bottom-0 block h-14 bg-gradient-to-t from-slate-950 to-slate-950/0" data-phone-fade="" />
    </div>
  );
}

export function AnywhereRow({ course, progress }: { course: AvailableCourse; progress: CourseProgress }): JSX.Element {
  const { anywhere } = course.rows;
  // Butir yang sama dengan kartu mengambang tidak diulang di daftar (keduanya bersebelahan di layar lebar).
  const points = anywhere.points.filter((point) => point.text !== anywhere.floating);
  return (
    <FeatureRow
      name="anywhere"
      title={anywhere.title}
      lead={anywhere.lead}
      extra={
        <ul className="m-0 mt-1 flex list-none flex-col gap-3 p-0">
          {points.map((point) => (
            <li key={point.text} className="flex items-center gap-3 text-base text-q-ink">
              <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-q bg-q-tint text-q-primary-ink">
                <Icon name={point.icon} className="h-[18px] w-[18px]" />
              </span>
              {point.text}
            </li>
          ))}
        </ul>
      }
      visual={
        <div className="relative mx-auto w-[220px] py-4 sm:w-[260px]">
          {/* Cahaya mint di belakang ponsel: siluet bingkai gelapnya tetap terbaca di latar halaman tema gelap. */}
          <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[88%] w-[130%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-q-primary/15 blur-2xl" />
          <PhoneMockup label={anywhere.phoneLabel} className="relative w-full">
            <PhoneScreen course={course} progress={progress} />
          </PhoneMockup>
          {/*
            Menumpang di bingkai bawah ponsel, di bawah baris terakhir yang sudah memudar: tidak menutupi judul tier atau
            angka kemajuan (diperiksa e2e). Miring di pembungkus: animasi q-float memakai transform elemen dalamnya.
          */}
          <div className="absolute -bottom-3 -right-6 rotate-3 sm:-right-20" data-testid="anywhere-floating">
            <p className="q-float m-0 flex items-center gap-2.5 rounded-q-lg border border-q-border bg-q-surface py-3 pl-3 pr-4 text-sm font-bold text-q-ink shadow-q-pop">
              <span aria-hidden className="grid h-8 w-8 place-items-center rounded-q bg-q-amber-soft text-q-amber-ink">
                <Zap className="h-4 w-4 fill-current" />
              </span>
              {anywhere.floating}
            </p>
          </div>
        </div>
      }
    />
  );
}
