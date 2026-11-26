/**
 * C6e — "Banyak cara belajar": tab pill (Materi, Hint, Urutan Eksekusi & Explain, Playground) yang mengganti isi kartu
 * dengan crossfade 200 ms (ui/Tabs: AnimatePresence mode="wait"). Isi tiap tab dari `course.rows.ways` — fitur yang
 * memang ada di aplikasi.
 */
import { Check } from 'lucide-react';
import type { AvailableCourse } from '../../../courses/types';
import { Icon } from '../../../ui/Icon';
import { Tabs, type TabItem } from '../../../ui/Tabs';
import { FeatureRow } from './FeatureRow';

type Ways = AvailableCourse['rows']['ways'];
type Way = Ways['tabs'][number];

function WayCard({ way }: { way: Way }): JSX.Element {
  return (
    <div className="flex flex-col gap-5 rounded-q-lg border border-q-border bg-q-surface p-6 shadow-q-float sm:p-8 lg:min-h-[320px]">
      <div className="flex items-center gap-4">
        <span aria-hidden className="grid h-14 w-14 shrink-0 place-items-center rounded-q bg-q-tint text-q-primary-ink">
          <Icon name={way.icon} className="h-7 w-7" />
        </span>
        <h4 className="m-0 text-balance text-[22px] font-bold leading-snug text-q-ink">{way.title}</h4>
      </div>
      <p className="m-0 max-w-[56ch] text-pretty text-base leading-relaxed text-q-ink-soft">{way.text}</p>
      <ul className="m-0 flex list-none flex-col gap-3 border-t border-q-border p-0 pt-5">
        {way.bullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-3 text-[15px] leading-snug text-q-ink">
            <span aria-hidden className="mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full bg-q-primary text-q-on-primary">
              <Check className="h-3 w-3" strokeWidth={3.5} />
            </span>
            {bullet}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function WaysRow({ course }: { course: AvailableCourse }): JSX.Element {
  const { ways } = course.rows;
  const items: readonly TabItem[] = ways.tabs.map((tab) => ({ value: tab.id, label: tab.label, icon: <Icon name={tab.icon} className="h-4 w-4" /> }));
  return (
    <FeatureRow
      name="ways"
      title={ways.title}
      lead={ways.lead}
      visual={
        <Tabs items={items} ariaLabel={ways.tabsLabel} size="sm" panelClassName="mt-5">
          {(value) => {
            const way = ways.tabs.find((tab) => tab.id === value) ?? ways.tabs[0];
            return way ? <WayCard way={way} /> : null;
          }}
        </Tabs>
      }
    />
  );
}
