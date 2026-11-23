import { useMemo } from 'react';
import type { Database } from 'sql.js';
import type { CompletionSchema } from '../lib/sqlComplete';
import { readTableColumns } from '../lib/sqlEngine';

const EMPTY_SCHEMA: CompletionSchema = { tables: [] };

/**
 * Daftar tabel/kolom untuk autocomplete editor. `version` dinaikkan pemanggil setiap kali skema
 * mungkin berubah (mis. engine.dbVersion setelah CREATE/DROP di Playground).
 */
export function useCompletionSchema(db: Database | null, version = 0): CompletionSchema {
  return useMemo(() => {
    void version; // dependensi: baca ulang skema setiap versi berubah
    if (!db) return EMPTY_SCHEMA;
    try {
      return { tables: readTableColumns(db) };
    } catch {
      return EMPTY_SCHEMA;
    }
  }, [db, version]);
}
