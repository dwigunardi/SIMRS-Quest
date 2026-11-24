/**
 * Bagian 6 — "Belajar sambil praktik." (latar mint): tab jenis latihan + mockup editor gelap berisi misi sungguhan.
 * Mockup ini TIDAK menjalankan SQL; keterangan kecil di bawahnya mengatakan begitu.
 */
import { PRACTICE, SECTION_IDS, type PracticeTabId } from '../lib/content';
import { Icon } from '../ui/Icon';
import { Reveal } from '../ui/Reveal';
import { Section } from '../ui/Section';
import { SectionHeading } from '../ui/SectionHeading';
import { Tabs, type TabItem } from '../ui/Tabs';
import { PracticePanel } from './PracticeSection/panels';

const HEADING_ID = 'praktik-judul';

const TAB_ORDER: readonly PracticeTabId[] = ['query', 'fix', 'predict', 'injection', 'playground'];

const TAB_ITEMS: readonly TabItem<PracticeTabId>[] = TAB_ORDER.map((id) => ({
  value: id,
  label: PRACTICE.tabs[id].label,
  icon: <Icon name={PRACTICE.tabs[id].icon} className="h-4 w-4" />,
}));

export function PracticeSection(): JSX.Element {
  return (
    <Section id={SECTION_IDS.practice} tone="tint" labelledBy={HEADING_ID}>
      <Reveal>
        <SectionHeading id={HEADING_ID} title={PRACTICE.title} lead={PRACTICE.lead} />
      </Reveal>
      <Reveal className="mt-10">
        <Tabs<PracticeTabId> items={TAB_ITEMS} ariaLabel={PRACTICE.tabsLabel} defaultValue="query" panelClassName="mt-8">
          {(value) => <PracticePanel tab={value} />}
        </Tabs>
        <p className="mt-6 text-center text-sm text-q-ink-soft">{PRACTICE.sampleNote}</p>
      </Reveal>
    </Section>
  );
}
