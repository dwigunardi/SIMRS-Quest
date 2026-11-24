/**
 * Dua kartu pendamping bola dunia (hanya layar lebar): sebuah query ke tabel pasien dan hasilnya — kota-kota yang sama
 * dengan penanda di bola dunia. Angkanya berasal dari PATIENT_CITIES (dicocokkan dengan database latihan oleh verify).
 */
import { motion } from 'framer-motion';
import { cn } from '../../lib/cn';
import { HERO, PATIENT_CITIES, PRACTICE } from '../../lib/content';
import { fadeIn } from '../../lib/motion';
import { Card } from '../../ui/Card';
import { CodeWindow } from '../../ui/CodeWindow';

const CITY_QUERY = HERO.cityQuery;

export interface CityQueryCodeProps {
  /** Dipanggil saat query selesai "diketik". */
  onTyped: () => void;
  className?: string;
}

export function CityQueryCode({ onTyped, className }: CityQueryCodeProps): JSX.Element {
  return (
    <CodeWindow
      code={CITY_QUERY.sql}
      fileName={CITY_QUERY.fileName}
      ariaLabel={CITY_QUERY.codeLabel}
      typing
      typingSpeed={22}
      typingDelay={500}
      onTyped={onTyped}
      showLineNumbers={false}
      className={cn('rounded-q', className)}
    />
  );
}

const rows = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
} as const;

export interface CityQueryResultProps {
  /** Baris muncul bergiliran setelah query selesai diketik. */
  revealed: boolean;
  className?: string;
}

export function CityQueryResult({ revealed, className }: CityQueryResultProps): JSX.Element {
  return (
    <Card as="figure" radius="md" shadow="float" padding="none" aria-label={CITY_QUERY.resultLabel} className={cn('m-0 overflow-hidden text-left', className)}>
      <table className="w-full border-collapse font-mono text-[13px]">
        <thead>
          <tr className="border-b border-q-border bg-q-muted text-q-ink-soft">
            <th scope="col" className="px-4 py-2 text-left font-medium">
              {CITY_QUERY.columns[0]}
            </th>
            <th scope="col" className="px-4 py-2 text-right font-medium">
              {CITY_QUERY.columns[1]}
            </th>
          </tr>
        </thead>
        <motion.tbody variants={rows} initial="hidden" animate={revealed ? 'show' : 'hidden'}>
          {PATIENT_CITIES.map((city) => (
            <motion.tr key={city.name} variants={fadeIn} className="border-b border-q-border last:border-b-0">
              <td className="px-4 py-1.5 text-q-ink">
                <span className="inline-flex items-center gap-2">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-q-amber" />
                  {city.name}
                </span>
              </td>
              <td className="px-4 py-1.5 text-right tabular-nums text-q-ink">{city.patients}</td>
            </motion.tr>
          ))}
        </motion.tbody>
      </table>
      <figcaption className="border-t border-q-border px-4 py-2 font-q-body text-xs text-q-ink-soft">{PRACTICE.rowCount(PATIENT_CITIES.length)}</figcaption>
    </Card>
  );
}
