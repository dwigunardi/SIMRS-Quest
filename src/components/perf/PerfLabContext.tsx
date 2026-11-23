import { createContext } from 'react';

export interface PerfLabLink {
  /** Buka Lab Performa (Free Playground → Data besar) dengan SQL ini di editor. */
  open: (sql: string) => void;
}

/** Disediakan App; null di luar aplikasi → tombol "Uji di data besar" tidak ditampilkan. */
export const PerfLabContext = createContext<PerfLabLink | null>(null);
