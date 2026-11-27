import { AnimatePresence, motion } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { THEME_TOGGLE_LABEL, useTheme } from '../hooks/useTheme';
import { cn } from '../lib/cn';
import { crossfade } from '../lib/motion';

export interface ThemeToggleProps {
  className?: string;
}

/**
 * Tombol ikon penukar tema landing (terang ↔ gelap). Ikon menunjukkan tema yang sedang aktif; aria-label menyebut
 * aksinya ("Ganti ke tema gelap"); atribut title memberi keterangan yang sama saat disorot (tanpa pustaka tooltip —
 * satu keterangan tidak sepadan dengan popper + floating-ui di chunk awal). Pilihan tersimpan lewat useTheme. Labelnya
 * satu sumber dengan tombol tema di header jalur (THEME_TOGGLE_LABEL, src/platform/theme.ts).
 */
export function ThemeToggle({ className }: ThemeToggleProps): JSX.Element {
  const { theme, toggleTheme } = useTheme();
  const label = THEME_TOGGLE_LABEL[theme];
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      data-testid="theme-toggle"
      className={cn(
        'grid h-9 w-9 shrink-0 place-items-center rounded-q border border-q-border bg-q-surface text-q-ink transition-colors duration-150 hover:bg-q-muted',
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          aria-hidden
          className="grid place-items-center"
          initial={{ opacity: 0, rotate: -60, scale: 0.6 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 60, scale: 0.6 }}
          transition={crossfade}
        >
          {theme === 'dark' ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
