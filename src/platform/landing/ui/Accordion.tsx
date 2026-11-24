import type { ReactNode } from 'react';
import * as RadixAccordion from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';
import { cn } from '../lib/cn';

export interface AccordionItem {
  id: string;
  question: string;
  answer: ReactNode;
}

export interface AccordionProps {
  items: readonly AccordionItem[];
  /** id butir yang terbuka sejak awal. */
  defaultOpenId?: string;
  /** Tingkat judul tiap pertanyaan (bawaan h3, karena judul section-nya h2). */
  headingLevel?: 'h3' | 'h4';
  className?: string;
}

/**
 * Daftar tanya-jawab (Radix Accordion, satu terbuka sekaligus, bisa ditutup lagi). Tinggi isi dianimasikan lewat
 * variabel --radix-accordion-content-height; kelas q-anim mematikannya saat reduced motion.
 */
export function Accordion({ items, defaultOpenId, headingLevel = 'h3', className }: AccordionProps): JSX.Element {
  const Heading = headingLevel;
  return (
    <RadixAccordion.Root type="single" collapsible defaultValue={defaultOpenId} className={cn('divide-y divide-q-border border-y border-q-border', className)}>
      {items.map((item) => (
        <RadixAccordion.Item key={item.id} value={item.id}>
          <RadixAccordion.Header asChild>
            <Heading className="m-0">
              <RadixAccordion.Trigger className="group flex w-full items-center justify-between gap-4 rounded-q py-5 text-left font-q-body text-lg font-bold text-q-ink transition-colors duration-150 hover:text-q-primary-ink">
                <span className="text-pretty">{item.question}</span>
                <span
                  aria-hidden
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-q-pill bg-q-muted text-q-ink-soft transition-transform duration-200 group-data-[state=open]:rotate-180 motion-reduce:transition-none"
                >
                  <ChevronDown className="h-5 w-5" />
                </span>
              </RadixAccordion.Trigger>
            </Heading>
          </RadixAccordion.Header>
          <RadixAccordion.Content className="q-anim overflow-hidden data-[state=closed]:animate-q-accordion-up data-[state=open]:animate-q-accordion-down">
            <div className="flex max-w-[70ch] flex-col gap-3 pb-6 pr-12 text-base leading-relaxed text-q-ink-soft">{item.answer}</div>
          </RadixAccordion.Content>
        </RadixAccordion.Item>
      ))}
    </RadixAccordion.Root>
  );
}
