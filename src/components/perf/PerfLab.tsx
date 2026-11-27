import { Database, FlaskConical, Gauge, Loader2, Play, RotateCcw, Square, Trash2 } from 'lucide-react';
import { SqlEditor } from '../SqlEditor';
import { ResultTable } from '../ResultTable';
import { SqlErrorCard } from '../MissionOutput';
import { SECONDARY_BUTTON } from '../workspaces/WorkspaceChrome';
import { BIG_PATIENTS, BIG_VISITS } from '../../lib/bigData';
import { LAB_PRESETS, LAB_PREVIEW_ROWS, type LabSuccess, type PlanAccess } from '../../lib/perfLab';
import type { CompletionSchema } from '../../lib/sqlComplete';
import type { LabHistoryEntry, PerfLabApi } from '../../hooks/usePerfLab';

export interface PerfLabProps {
  lab: PerfLabApi;
  schema: CompletionSchema;
}

const fmt = (n: number) => n.toLocaleString('id-ID');

/** Waktu dengan presisi yang masuk akal: 0,06 ms · 19,2 ms · 1.240 ms. */
export function formatMs(ms: number): string {
  if (ms < 1) return `${ms.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ms`;
  if (ms < 100) return `${ms.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ms`;
  return `${fmt(Math.round(ms))} ms`;
}

const ACCESS: Record<PlanAccess, { label: string; cls: string }> = {
  scan: { label: 'SCAN', cls: 'border-rose-500/40 bg-rose-500/10 text-rose-200' },
  search: { label: 'SEARCH', cls: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200' },
  other: { label: '—', cls: 'border-slate-700 bg-slate-800/60 text-slate-400' },
};

/** Lab Performa: jalankan query di database besar (di worker terpisah) dan bandingkan waktunya antar-run. */
export function PerfLab({ lab, schema }: PerfLabProps): JSX.Element {
  const running = lab.status.kind === 'running';
  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-100">
          <FlaskConical className="h-5 w-5 text-cyan-300" aria-hidden />
          Lab Performa — data besar
        </h2>
        <p className="text-xs leading-relaxed text-slate-400">
          Skema yang sama dengan database latihan, tetapi berisi {fmt(BIG_VISITS)} kunjungan, ±{fmt(BIG_VISITS * 1.5)} diagnosa, dan{' '}
          {fmt(BIG_PATIENTS)} pasien sintetis (2025–2026). Di sini selisih SCAN dan SEARCH terasa dalam milidetik. Data dibuat di worker
          terpisah: database Playground dan penilaian misi tidak tersentuh. Index yang kamu buat bertahan sampai <em>Reset data besar</em>.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Percobaan siap pakai">
        {LAB_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => lab.loadPreset(p.id)}
            title={p.note}
            className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300 transition hover:border-cyan-400/60 hover:text-cyan-100"
          >
            {p.title}
          </button>
        ))}
      </div>
      {lab.note ? <p className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 px-3 py-2 text-xs leading-relaxed text-slate-300">{lab.note}</p> : null}

      <SqlEditor value={lab.sql} onChange={lab.setSql} onRun={lab.run} placeholder="Tulis query untuk diukur di data besar…" minHeightClass="min-h-[160px]" schema={schema} />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={lab.run}
          disabled={running}
          className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50 light:disabled:bg-slate-800 light:disabled:text-slate-500 light:disabled:opacity-100 light:disabled:shadow-none"
        >
          <Play className="h-4 w-4 fill-current" aria-hidden />
          Jalankan &amp; ukur
        </button>
        {/* Nonaktif sejak awal sampai data besar dibuat; gaya nonaktif tema terang ada di SECONDARY_BUTTON. */}
        <button type="button" onClick={lab.resetData} disabled={running || !lab.built} className={SECONDARY_BUTTON} title="Buang data besar beserta index buatanmu; disiapkan lagi saat dipakai">
          <RotateCcw className="h-4 w-4" aria-hidden />
          Reset data besar
        </button>
        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
          <Database className="h-3.5 w-3.5" aria-hidden />
          {lab.built ? 'Data besar siap di worker' : 'Data besar disiapkan pada run pertama (beberapa detik, ±75 MB memori)'}
        </span>
      </div>

      {running ? (
        <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3" role="status">
          <Loader2 className="h-5 w-5 animate-spin text-cyan-300" aria-hidden />
          <p className="flex-1 text-sm text-slate-300">{lab.built ? 'Menjalankan dan mengukur…' : `Menyiapkan ${fmt(BIG_VISITS)} kunjungan, lalu menjalankan query…`}</p>
          <button type="button" onClick={lab.cancel} className={`${SECONDARY_BUTTON} border-rose-500/40 text-rose-200 hover:bg-rose-500/10`}>
            <Square className="h-3.5 w-3.5 fill-current" aria-hidden />
            Hentikan
          </button>
        </div>
      ) : null}

      {lab.status.kind === 'stopped' ? (
        <p role="alert" className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-100">
          {lab.status.message}
        </p>
      ) : null}
      {lab.status.kind === 'done' && !lab.status.result.ok ? <SqlErrorCard friendlyError={lab.status.result.friendlyError} rawError={lab.status.result.rawError} /> : null}
      {lab.status.kind === 'done' && lab.status.result.ok ? <RunResult result={lab.status.result} buildMs={lab.status.buildMs} /> : null}

      {lab.history.length > 0 ? <History entries={lab.history} onClear={lab.clearHistory} onLoad={lab.setSql} /> : null}
    </div>
  );
}

function RunResult({ result, buildMs }: { result: LabSuccess; buildMs: number | null }) {
  return (
    <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4" aria-label="Hasil pengukuran">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <Gauge className="h-3.5 w-3.5" aria-hidden /> Waktu eksekusi
          </p>
          <p className="font-mono text-3xl font-bold tabular-nums text-slate-50" data-testid="lab-time">
            {formatMs(result.elapsedMs)}
          </p>
        </div>
        <p className="text-xs leading-relaxed text-slate-400">
          {result.runs > 1 ? `median dari ${result.runs} kali jalan` : 'dijalankan sekali (skrip mengubah data/skema)'}
          {result.setupMs !== null ? ` — hanya SELECT penutup; persiapan sebelumnya (CREATE INDEX dsb.) ${formatMs(result.setupMs)}, sekali jalan` : ''}
          {result.columns.length > 0 ? ` · ${fmt(result.rowCount)} baris hasil` : ''}
          {result.rowsModified > 0 ? ` · ${fmt(result.rowsModified)} baris berubah` : ''}
          {buildMs !== null ? ` · data besar disiapkan dalam ${(buildMs / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} dtk` : ''}
        </p>
      </div>

      {result.plan.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Query plan (statement terakhir)</p>
          <ul className="space-y-1" data-testid="lab-plan">
            {result.plan.map((line, i) => (
              <li key={i} className="flex items-start gap-2 font-mono text-xs text-slate-300">
                <span className={`shrink-0 rounded border px-1.5 py-px text-[10px] font-semibold ${ACCESS[line.access].cls}`}>{ACCESS[line.access].label}</span>
                <span className="break-all">{line.detail}</span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-slate-500">SCAN = membaca seluruh tabel/index baris demi baris · SEARCH = melompat ke baris yang cocok lewat index atau primary key.</p>
        </div>
      ) : null}

      {result.columns.length > 0 ? (
        <ResultTable
          result={{ columns: result.columns, rows: result.rows }}
          caption={result.rowCount > LAB_PREVIEW_ROWS ? `Cuplikan ${LAB_PREVIEW_ROWS} dari ${fmt(result.rowCount)} baris` : `${fmt(result.rowCount)} baris`}
          maxHeightClass="max-h-64"
        />
      ) : null}
    </section>
  );
}

function History({ entries, onClear, onLoad }: { entries: readonly LabHistoryEntry[]; onClear: () => void; onLoad: (sql: string) => void }) {
  const max = Math.max(...entries.map((e) => e.elapsedMs), 0.001);
  return (
    <section className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/40 p-4" aria-label="Riwayat pengukuran">
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Riwayat run — bandingkan</h3>
        <button type="button" onClick={onClear} className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] text-slate-500 hover:bg-slate-800 hover:text-slate-300">
          <Trash2 className="h-3 w-3" aria-hidden /> Bersihkan
        </button>
      </div>
      <ol className="space-y-1.5" data-testid="lab-history">
        {entries.map((e, i) => (
          <li key={e.id}>
            <button type="button" onClick={() => onLoad(e.sql)} className="block w-full rounded-lg px-2 py-1.5 text-left transition hover:bg-slate-800/60" title="Muat ulang query ini ke editor">
              <span className="flex items-baseline gap-2 text-xs">
                <span className="tabular-nums text-slate-500">#{i + 1}</span>
                <span className={`shrink-0 rounded border px-1.5 py-px text-[10px] font-semibold ${ACCESS[e.access].cls}`}>{e.mutated && e.access === 'other' ? 'DDL/DML' : ACCESS[e.access].label}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-slate-300">{e.label}</span>
                <span className="shrink-0 font-mono font-semibold tabular-nums text-slate-100">{formatMs(e.elapsedMs)}</span>
              </span>
              <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-800" aria-hidden>
                {/* Lebar minimum 1% supaya run tercepat tetap terlihat sebagai garis tipis. */}
                <span className={`block h-full rounded-full ${e.access === 'scan' ? 'bg-rose-400/80' : 'bg-emerald-400/80'}`} style={{ width: `${Math.max(1, (e.elapsedMs / max) * 100)}%` }} />
              </span>
            </button>
          </li>
        ))}
      </ol>
      <p className="text-[11px] text-slate-500">Batang dibandingkan dengan run paling lambat di riwayat ini. Klik sebuah run untuk memuat ulang query-nya.</p>
    </section>
  );
}
