import { useMemo, useState, type ReactNode } from 'react';
import type { Database } from 'sql.js';
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Database as DatabaseIcon,
  KeyRound,
  Link2,
  ListTree,
  Network,
  Repeat2,
  Table2,
  Zap,
} from 'lucide-react';
import { getSchemaInfo, previewTable } from '../lib/sqlEngine';
import { ResultTable } from './ResultTable';
import type { IndexInfo, TableInfo } from '../types';

export interface SchemaExplorerProps {
  db: Database | null;
  dbVersion: number;
}

interface Relationship {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
}

function collectRelationships(tables: TableInfo[]): Relationship[] {
  return tables.flatMap((table) =>
    table.columns.flatMap((column) => {
      if (!column.foreignKey) return [];
      return [
        {
          fromTable: table.name,
          fromColumn: column.name,
          toTable: column.foreignKey.table,
          toColumn: column.foreignKey.column,
        },
      ];
    }),
  );
}

export function SchemaExplorer({ db, dbVersion }: SchemaExplorerProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const tables = useMemo<TableInfo[]>(() => {
    if (!db) return [];
    // dbVersion dipakai sebagai pemicu agar schema dibaca ulang setelah mutasi/reset.
    void dbVersion;
    // Playground bisa membuat objek aneh (tabel virtual, dsb.); jangan sampai seluruh UI crash.
    try {
      return getSchemaInfo(db);
    } catch {
      return [];
    }
  }, [db, dbVersion]);

  const relationships = useMemo(() => collectRelationships(tables), [tables]);

  if (!db) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-500">
        Database belum siap.
      </div>
    );
  }

  const toggle = (name: string) => setExpanded((current) => (current === name ? null : name));

  return (
    <section className="space-y-3">
      <header className="flex items-center gap-2">
        <DatabaseIcon className="h-4 w-4 text-emerald-400" aria-hidden />
        <h2 className="text-sm font-semibold text-slate-100">Schema Explorer</h2>
        <span className="text-xs text-slate-500">{tables.length} tabel</span>
      </header>

      <ul className="space-y-2">
        {tables.map((table) => (
          <TableCard
            key={table.name}
            table={table}
            open={expanded === table.name}
            onToggle={() => toggle(table.name)}
            db={db}
            dbVersion={dbVersion}
          />
        ))}
      </ul>

      {relationships.length > 0 && <RelationshipSummary relationships={relationships} />}
    </section>
  );
}

interface TableCardProps {
  table: TableInfo;
  open: boolean;
  onToggle: () => void;
  db: Database;
  dbVersion: number;
}

function TableCard({ table, open, onToggle, db, dbVersion }: TableCardProps) {
  return (
    <li className={`rounded-xl border bg-slate-900/60 transition ${open ? 'border-emerald-500/30' : 'border-slate-800'}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-slate-800/40"
      >
        <Table2 className={`mt-0.5 h-4 w-4 shrink-0 ${open ? 'text-emerald-400' : 'text-teal-400'}`} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="font-mono text-sm font-semibold text-slate-100">{table.name}</span>
            <span className="text-[11px] tabular-nums text-slate-500">{table.rowCount} baris</span>
          </span>
          {table.description && <span className="mt-0.5 block text-xs leading-snug text-slate-400">{table.description}</span>}
        </span>
        <span className="mt-0.5 text-slate-500">
          {open ? <ChevronDown className="h-4 w-4" aria-hidden /> : <ChevronRight className="h-4 w-4" aria-hidden />}
        </span>
      </button>
      {open && <TableDetail table={table} db={db} dbVersion={dbVersion} />}
    </li>
  );
}

interface TableDetailProps {
  table: TableInfo;
  db: Database;
  dbVersion: number;
}

function TableDetail({ table, db, dbVersion }: TableDetailProps) {
  const preview = useMemo(() => {
    void dbVersion;
    try {
      return previewTable(db, table.name, 5);
    } catch {
      return { columns: [], rows: [] };
    }
  }, [db, table.name, dbVersion]);

  return (
    <div className="space-y-3 border-t border-slate-800 px-3 pb-3 pt-2">
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500">
              <th className="py-1 pr-3 font-medium">Kolom</th>
              <th className="py-1 pr-3 font-medium">Tipe</th>
              <th className="py-1 font-medium">Keterangan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {table.columns.map((column) => (
              <tr key={column.name}>
                <td className="py-1.5 pr-3 font-mono text-slate-200">{column.name}</td>
                <td className="py-1.5 pr-3 font-mono text-slate-400">{column.type || '—'}</td>
                <td className="py-1.5">
                  <span className="flex flex-wrap gap-1">
                    {column.isPrimaryKey && (
                      <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-300">
                        <KeyRound className="h-3 w-3" aria-hidden />
                        PK
                      </Badge>
                    )}
                    {column.foreignKey && (
                      <Badge className="border-teal-500/40 bg-teal-500/10 text-teal-300">
                        <Link2 className="h-3 w-3" aria-hidden />→ {column.foreignKey.table}.{column.foreignKey.column}
                      </Badge>
                    )}
                    {column.foreignKey?.table === table.name && (
                      <Badge className="border-violet-500/40 bg-violet-500/10 text-violet-300">
                        <Repeat2 className="h-3 w-3" aria-hidden />
                        self-reference
                      </Badge>
                    )}
                    {column.notNull && !column.isPrimaryKey && (
                      <Badge className="border-slate-700 bg-slate-800 text-slate-400">NOT NULL</Badge>
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <IndexSection indexes={table.indexes} />
      <div>
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">Preview 5 baris pertama</p>
        <ResultTable result={preview} maxHeightClass="max-h-56" />
      </div>
    </div>
  );
}

function Badge({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-px font-mono text-[10px] font-semibold ${className}`}>
      {children}
    </span>
  );
}

function RelationshipSummary({ relationships }: { relationships: Relationship[] }) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
      <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        <Network className="h-4 w-4 text-teal-400" aria-hidden />
        Relasi antar tabel
      </h3>
      <ul className="space-y-1">
        {relationships.map((rel) => (
          <li
            key={`${rel.fromTable}.${rel.fromColumn}`}
            className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-slate-300"
          >
            <span>
              {rel.fromTable}.<span className="text-teal-300">{rel.fromColumn}</span>
            </span>
            <ArrowRight className="h-3 w-3 text-slate-500" aria-hidden />
            <span>
              {rel.toTable}.<span className="text-amber-300">{rel.toColumn}</span>
            </span>
            {rel.fromTable === rel.toTable && (
              <span className="inline-flex items-center gap-1 rounded border border-violet-500/40 bg-violet-500/10 px-1.5 py-px font-sans text-[10px] text-violet-300">
                <Repeat2 className="h-3 w-3" aria-hidden />
                relasi ke tabel sendiri (hierarki — cocok untuk WITH RECURSIVE)
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

const INDEX_ORIGIN_LABEL: Record<IndexInfo['origin'], string> = {
  pk: 'otomatis (PK)',
  u: 'otomatis (UNIQUE)',
  c: 'CREATE INDEX',
};

function IndexSection({ indexes }: { indexes: IndexInfo[] }) {
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">
        <ListTree className="h-3.5 w-3.5 text-sky-400" aria-hidden />
        Index
      </p>
      {indexes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-800 px-3 py-2 text-xs text-slate-500">
          Belum ada index terpisah — pencarian berdasarkan kolom selain INTEGER PRIMARY KEY (rowid) akan membaca seluruh tabel (SCAN).
        </p>
      ) : (
        <ul className="space-y-1">
          {indexes.map((index) => (
            <li
              key={index.name}
              className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/40 px-2.5 py-1.5 text-[11px]"
            >
              <Zap className="h-3 w-3 shrink-0 text-sky-400" aria-hidden />
              <span className="font-mono text-slate-200">{index.name}</span>
              <span className="font-mono text-slate-400">({index.columns.join(', ')})</span>
              {index.unique && <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-300">UNIQUE</Badge>}
              <span
                className={`ml-auto rounded px-1.5 py-px text-[10px] ${
                  index.origin === 'c' ? 'bg-sky-500/15 text-sky-300' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {INDEX_ORIGIN_LABEL[index.origin]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
