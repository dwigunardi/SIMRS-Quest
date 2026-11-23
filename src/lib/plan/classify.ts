/** Explain: klasifikasi satu baris EXPLAIN QUERY PLAN menjadi langkah berpenjelasan. */
import type { PlanNode, PlanNodeKind, PlanTone, TableInfo } from '../../types';
import { unique } from './sqlText';
import type { IndexOwner, SchemaContext } from './schema';
import { type NameScope, resolveSource } from './names';

/* ------------------------------------------------------------------ */
/* Deskripsi index, syarat pencarian, saran index                      */
/* ------------------------------------------------------------------ */

export function describeIndex(name: string, owner: IndexOwner | undefined): string {
  if (!owner) return `index ${name}`;
  const cols = owner.index.columns.join(', ');
  if (owner.index.origin === 'pk') return `index PRIMARY KEY (${cols})`;
  if (owner.index.origin === 'u') return `index UNIQUE (${cols})`;
  const partial = owner.index.partial ? 'partial index' : 'index';
  return `${partial} ${owner.index.name} (${cols})`;
}

export interface ConstraintInfo {
  text: string;
  columns: string[];
  /** Ada kolom yang hanya dibatasi satu sisi (col>? saja / col<? saja). */
  oneSided: boolean;
}

export const CONSTRAINT_TERM = /^(.+?)\s*(=|>=|<=|>|<)\s*\?$/;

/** "no_rm=?" → "no_rm = …"; "tgl>? AND tgl<?" → "tgl di antara dua batas". */
export function describeConstraints(constraints: string): ConstraintInfo {
  const bounds = new Map<string, { eq: boolean; lower: boolean; upper: boolean }>();
  const unknown: string[] = [];
  for (const term of constraints.split(/\s+AND\s+/i)) {
    const match = CONSTRAINT_TERM.exec(term.trim());
    const column = match?.[1]?.trim();
    const op = match?.[2];
    if (!column || !op) {
      if (term.trim()) unknown.push(term.trim());
      continue;
    }
    const entry = bounds.get(column) ?? { eq: false, lower: false, upper: false };
    if (op === '=') entry.eq = true;
    if (op.startsWith('>')) entry.lower = true;
    if (op.startsWith('<')) entry.upper = true;
    bounds.set(column, entry);
  }

  let oneSided = false;
  const parts: string[] = [];
  for (const [column, b] of bounds) {
    if (b.eq) parts.push(`${column} = …`);
    else if (b.lower && b.upper) parts.push(`${column} di antara dua batas`);
    else {
      oneSided = true;
      parts.push(b.lower ? `${column} > …` : `${column} < …`);
    }
  }
  return { text: [...parts, ...unknown].join(', '), columns: [...bounds.keys()], oneSided };
}


export function rowsLabel(rows: number | null): string {
  return rows === null ? 'seluruh baris' : `seluruh ${rows} baris`;
}

/* ------------------------------------------------------------------ */
/* Klasifikasi satu baris plan                                         */
/* ------------------------------------------------------------------ */

export type Classified = Omit<PlanNode, 'id' | 'parent' | 'detail' | 'children' | 'repeated' | 'innerLoop' | 'fkCheck' | 'stopsEarly'> & {
  /** Node ini membuat turunannya dijalankan ulang per baris luar (subquery berkorelasi). */
  correlated: boolean;
  /** Langkah akses tabel/hasil (SCAN/SEARCH) — dipakai untuk mendeteksi nested loop. */
  access: boolean;
  /** Kolom untuk saran index (AUTOMATIC INDEX), jika ada. */
  suggestColumns: string[];
  /** Langkah akses bertanda EXISTS: berhenti di baris cocok pertama, jadi bukan loop luar yang berulang. */
  existsLoop: boolean;
};

export function base(kind: PlanNodeKind, tone: PlanTone, title: string, explanation: string): Classified {
  return {
    kind,
    tone,
    title,
    explanation,
    table: null,
    object: null,
    index: null,
    indexColumns: [],
    constraints: null,
    covering: false,
    tableRows: null,
    suggestion: null,
    correlated: false,
    access: false,
    suggestColumns: [],
    existsLoop: false,
  };
}

export const CONSTANT_ROW = /^SCAN\s+(?:\d+\s+)?CONSTANT\s+ROWS?$/i;
export const ACCESS = /^(SCAN|SEARCH)\s+(?:TABLE\s+)?(\([^)]*\)|\S+)(?:\s+AS\s+(\S+))?(.*)$/i;
export const AUTO_INDEX = /\bUSING\s+AUTOMATIC\s+(?:PARTIAL\s+)?(COVERING\s+)?INDEX\b(?:\s*\(([^)]*)\))?/i;
export const NAMED_INDEX = /\bUSING\s+(COVERING\s+)?INDEX\s+([^\s(]+)(?:\s*\(([^)]*)\))?/i;
export const ROWID = /\bUSING\s+(?:INTEGER\s+)?PRIMARY\s+KEY\b(?:\s*\(([^)]*)\))?/i;

export interface ClassifyContext {
  scope: NameScope;
  schema: SchemaContext;
  /** Baris plan ini punya parent (berada di dalam subquery/CTE/cabang). */
  nested: boolean;
  /** Teks statement ter-normalisasi. */
  clean: string;
  /** CTE yang hasilnya sudah dibuat (CO-ROUTINE/MATERIALIZE) dan dibaca dari LUAR subtree-nya. */
  cteResults: ReadonlySet<string>;
}

/** MIN(x)/MAX(x) dengan x = rowid atau INTEGER PRIMARY KEY tabel ini → cukup satu baris di ujung B-tree. */
export function minMaxOnRowid(clean: string, table: TableInfo, object: string): boolean {
  const rowidNames = new Set(['rowid', '_rowid_', 'oid']);
  const pk = table.columns.filter((c) => c.isPrimaryKey);
  const onlyPk = pk.length === 1 ? pk[0] : undefined;
  if (onlyPk && onlyPk.type.toUpperCase() === 'INTEGER') rowidNames.add(onlyPk.name.toLowerCase());
  const qualifiers = new Set([table.name.toLowerCase(), object.toLowerCase()]);
  for (const match of clean.matchAll(/\b(?:MIN|MAX)\s*\(\s*(?:([A-Za-z_][A-Za-z0-9_]*)\.)?([A-Za-z_][A-Za-z0-9_]*)\s*\)/gi)) {
    const qualifier = match[1]?.toLowerCase();
    const column = match[2]?.toLowerCase() ?? '';
    if (rowidNames.has(column) && (qualifier === undefined || qualifiers.has(qualifier))) return true;
  }
  return false;
}

export const ACCESS_HEAD = /^(SCAN|SEARCH)\s+(?:TABLE\s+)?/i;
export const ACCESS_TAIL = /^(?:\s+AS\s+(\S+))?(.*)$/i;

/**
 * Memecah baris SCAN/SEARCH menjadi [op, nama objek, alias, sisa]. Nama tabel yang dikenal skema dicoba
 * lebih dulu (terpanjang dulu) agar nama berspasi seperti "my tab" tidak terpotong oleh \S+.
 */
export function parseAccess(detail: string, schema: SchemaContext): { op: string; name: string; alias: string | null; rest: string } | null {
  const head = ACCESS_HEAD.exec(detail);
  if (!head) return null;
  const after = detail.slice(head[0].length);
  const lower = after.toLowerCase();
  const known = [...schema.tables.values()]
    .map((t) => t.name)
    .filter((n) => /\s/.test(n))
    .sort((a, b) => b.length - a.length)
    .find((n) => lower.startsWith(n.toLowerCase()) && /^(?:\s|$)/.test(after.slice(n.length)));
  if (known) {
    const tail = ACCESS_TAIL.exec(after.slice(known.length));
    return { op: (head[1] ?? '').toUpperCase(), name: known, alias: tail?.[1] ?? null, rest: tail?.[2] ?? '' };
  }
  const match = ACCESS.exec(detail);
  if (!match) return null;
  return { op: (match[1] ?? '').toUpperCase(), name: match[2] ?? '', alias: match[3] ?? null, rest: match[4] ?? '' };
}

export function classifyAccess(detail: string, ctx: ClassifyContext): Classified | null {
  const parsed = parseAccess(detail, ctx.schema);
  if (!parsed) return null;
  const { op, rest } = parsed;
  const object = parsed.alias ?? parsed.name;
  const names = [parsed.name, parsed.alias].filter((n): n is string => Boolean(n));

  const auto = AUTO_INDEX.exec(rest);
  const named = auto ? null : NAMED_INDEX.exec(rest);
  const rowid = auto || named ? null : ROWID.exec(rest);
  const indexName = named?.[2] ?? null;
  const owner = indexName ? ctx.schema.indexes.get(indexName.toLowerCase()) : undefined;
  const constraints = (auto?.[2] ?? named?.[3] ?? rowid?.[1] ?? '').trim() || null;
  const hintColumns = rowid ? [] : describeConstraints(constraints ?? '').columns;
  const source = resolveSource(names, ctx.scope, ctx.schema, ctx.nested, owner?.table ?? null, hintColumns, ctx.cteResults);
  const table = source.type === 'table' ? source.table : null;
  const covering = Boolean(auto?.[1] ?? named?.[1]);
  const exists = /\bEXISTS\b/i.test(rest);
  const leftJoin = /\bLEFT-JOIN\b/i.test(rest);

  const finish = (node: Classified): Classified => {
    const notes: string[] = [node.explanation];
    if (covering) notes.push('COVERING: semua kolom yang dibutuhkan sudah ada di index, jadi tabelnya sendiri tidak perlu dibuka.');
    if (exists) notes.push('EXISTS: pencarian berhenti di baris pertama yang cocok.');
    if (leftJoin) notes.push('Bagian dari LEFT/FULL JOIN: baris tanpa pasangan tetap dipertahankan (diisi NULL).');
    return {
      ...node,
      explanation: notes.join(' '),
      table: table?.name ?? null,
      object,
      index: indexName,
      indexColumns: owner?.index.columns ?? [],
      constraints,
      covering,
      tableRows: table?.rowCount ?? null,
      access: true,
      existsLoop: exists,
    };
  };

  if (op === 'SCAN') {
    if (!table) {
      if (source.type === 'subquery') {
        return finish(base('derived-scan', 'neutral', 'Baca hasil subquery', 'Membaca baris hasil subquery yang dihitung oleh langkah co-routine/materialize di atasnya.'));
      }
      if (source.type === 'cte') {
        return finish(base('derived-scan', 'neutral', 'Baca hasil CTE', `Membaca baris hasil CTE ${source.name}.`));
      }
      return finish(
        base('derived-scan', 'neutral', 'Baca sumber data', `Membaca seluruh baris dari ${object} (alias, CTE, atau view yang tidak dikenali sebagai tabel).`),
      );
    }
    if (indexName && owner?.index.partial) {
      return finish(
        base(
          'index-search',
          'good',
          'Scan partial index',
          `Menelusuri ${describeIndex(indexName, owner)} — partial index hanya berisi baris yang memenuhi klausa WHERE-nya, jadi hanya baris itu yang dibaca, bukan ${rowsLabel(table.rowCount)} tabel ${table.name}.`,
        ),
      );
    }
    if (indexName) {
      return finish(
        base(
          'index-scan',
          'warn',
          'Scan seluruh index',
          `Menelusuri ${describeIndex(indexName, owner)} dari awal sampai akhir — tidak melompat ke baris tertentu, jadi ${rowsLabel(table.rowCount)} tetap dilewati. Biasanya dipilih agar hasil sudah urut (ORDER BY/GROUP BY) atau karena index lebih kecil dibaca daripada tabelnya (mis. COUNT(*)).`,
        ),
      );
    }
    return finish(
      base('full-scan', 'warn', 'Full table scan', `Membaca ${rowsLabel(table.rowCount)} tabel ${table.name} satu per satu, lalu memeriksa setiap baris.`),
    );
  }

  // SEARCH
  if (auto) {
    const info = describeConstraints(constraints ?? '');
    if (!table) {
      return finish(
        base('auto-index', 'info', 'Index sementara (AUTOMATIC)', `SQLite membangun index sementara pada hasil ${object} agar pencarian pasangan JOIN (${info.text || 'syarat join'}) lebih cepat.`),
      );
    }
    const columnsText = info.columns.length > 0 ? info.columns.join(', ') : 'kolom join';
    return finish({
      ...base(
        'auto-index',
        'warn',
        'Index sementara (AUTOMATIC)',
        `Tidak ada index pada ${table.name}(${columnsText}) yang bisa dipakai, jadi SQLite membangun index SEMENTARA setiap kali query dijalankan — membaca ${rowsLabel(table.rowCount)} dulu — lalu memakainya untuk mencari pasangan JOIN. Index itu dibuang setelah query selesai.`,
      ),
      suggestColumns: info.columns,
    });
  }

  const tableLabel = table?.name ?? object;
  if (rowid) {
    return finish(
      base('rowid-search', 'good', 'Pencarian lewat PRIMARY KEY', `Lompat langsung ke baris ${tableLabel} lewat rowid / INTEGER PRIMARY KEY — cara tercepat mengambil baris di SQLite.`),
    );
  }
  if (indexName) {
    const indexLabel = describeIndex(indexName, owner);
    if (!constraints) {
      return finish(
        base('index-search', 'good', 'Ambil ujung index', `Mengambil langsung entri di ujung ${indexLabel} (dipakai untuk MIN/MAX) — cukup membaca satu entri, bukan seluruh tabel.`),
      );
    }
    const info = describeConstraints(constraints);
    const oneSided = info.oneSided
      ? ' Rentangnya hanya satu sisi, jadi yang dibaca adalah semua entri dari batas itu sampai ujung index.'
      : '';
    return finish(
      base('index-search', 'good', 'Pencarian lewat index', `Lompat langsung ke baris ${tableLabel} yang cocok lewat ${indexLabel}, berdasarkan ${info.text}.${oneSided}`),
    );
  }
  if (table && minMaxOnRowid(ctx.clean, table, object)) {
    return finish(
      base(
        'rowid-search',
        'good',
        'Ambil ujung PRIMARY KEY',
        `MIN/MAX pada rowid / INTEGER PRIMARY KEY: SQLite langsung membaca satu baris di ujung B-tree tabel ${table.name} — tidak perlu index tambahan.`,
      ),
    );
  }
  if (table) {
    // "SEARCH t" tanpa USING: jalur MIN/MAX tanpa index yang cocok — tetap membaca seluruh tabel.
    return finish(
      base(
        'full-scan',
        'warn',
        'Full table scan (MIN/MAX)',
        `Tidak ada index untuk MIN/MAX ini, jadi SQLite membaca ${rowsLabel(table.rowCount)} tabel ${table.name} satu per satu untuk mencari nilai terkecil/terbesar. Dengan index pada kolom itu, cukup satu entri di ujung index yang dibaca.`,
      ),
    );
  }
  return finish(base('other', 'neutral', 'Pencarian', `Mencari baris pada ${tableLabel}.`));
}

export const IN_OPERATOR_INDEX = /^USING\s+(COVERING\s+)?INDEX\s+(\S+)\s+FOR\s+IN-OPERATOR$/i;
export const IN_OPERATOR_ROWID = /^USING\s+ROWID\s+SEARCH\s+ON\s+TABLE\s+(\S+)\s+FOR\s+IN-OPERATOR$/i;

/** "USING INDEX idx FOR IN-OPERATOR": keanggotaan IN/NOT IN dicek langsung lewat index (bukan langkah loop). */
export function classifyInOperator(detail: string, ctx: ClassifyContext): Classified | null {
  const viaIndex = IN_OPERATOR_INDEX.exec(detail);
  const viaRowid = viaIndex ? null : IN_OPERATOR_ROWID.exec(detail);
  if (!viaIndex && !viaRowid) return null;

  const indexName = viaIndex?.[2] ?? null;
  const owner = indexName ? ctx.schema.indexes.get(indexName.toLowerCase()) : undefined;
  const source = owner ? null : resolveSource([viaRowid?.[1] ?? ''], ctx.scope, ctx.schema, ctx.nested, null);
  const table = owner?.table ?? (source?.type === 'table' ? source.table : null);
  const where = indexName ? describeIndex(indexName, owner) : 'rowid / INTEGER PRIMARY KEY';
  return {
    ...base(
      'index-search',
      'good',
      'Cek IN lewat index',
      `Untuk memeriksa apakah sebuah nilai ada di daftar IN (…)/NOT IN (…), SQLite mencarinya langsung di ${where}${table ? ` milik ${table.name}` : ''} — tidak perlu membaca seluruh tabel.`,
    ),
    table: table?.name ?? null,
    index: indexName,
    indexColumns: owner?.index.columns ?? [],
    covering: Boolean(viaIndex?.[1]),
    tableRows: table?.rowCount ?? null,
  };
}

export const TEMP_BTREE_PURPOSE: ReadonlyArray<{ pattern: RegExp; title: string; explanation: string }> = [
  {
    pattern: /^(?:LAST\s+(?:\d+\s+TERMS|TERM)\s+OF|RIGHT\s+PART\s+OF)\s+ORDER\s+BY$/i,
    title: 'Pengurutan sebagian',
    explanation: 'Sebagian urutan sudah didapat dari index; kolom ORDER BY sisanya masih diurutkan ulang di memori.',
  },
  {
    pattern: /^ORDER BY$/i,
    title: 'Pengurutan sementara',
    explanation: 'Hasil harus diurutkan dulu di memori (B-tree sementara) karena tidak ada index yang sudah urut sesuai ORDER BY.',
  },
  {
    pattern: /^GROUP BY$/i,
    title: 'Pengelompokan sementara',
    explanation: 'Baris dikelompokkan lewat B-tree sementara karena tidak ada index yang urut sesuai kolom GROUP BY.',
  },
  {
    pattern: /^DISTINCT$/i,
    title: 'Buang duplikat',
    explanation: 'Duplikat dibuang lewat B-tree sementara yang mencatat nilai yang sudah pernah muncul.',
  },
];

export interface StructureRule {
  pattern: RegExp;
  /** `tableName` memetakan nama/alias di plan ke nama tabel fisik (atau mengembalikannya apa adanya). */
  build: (match: RegExpExecArray, tableName: (name: string) => string) => Classified;
}

export function coroutineLabel(name: string): string {
  const trimmed = name.trim();
  if (/^\(subquery-\d+\)$/i.test(trimmed)) return 'Subquery tanpa nama (termasuk hasil window function)';
  return `Hasil ${trimmed}`;
}

export const STRUCTURE_RULES: readonly StructureRule[] = [
  {
    pattern: /^USE TEMP B-TREE FOR (.+)$/i,
    build: (m) => {
      const purpose = (m[1] ?? '').trim();
      const rule = TEMP_BTREE_PURPOSE.find((r) => r.pattern.test(purpose));
      return base(
        'temp-btree',
        'warn',
        rule?.title ?? 'B-tree sementara',
        rule?.explanation ?? `SQLite memakai B-tree sementara di memori (${purpose}).`,
      );
    },
  },
  {
    pattern: /^BLOOM FILTER ON (\S+)/i,
    build: (m, tableName) =>
      base(
        'bloom-filter',
        'info',
        'Bloom filter',
        `Saringan cepat untuk ${tableName(m[1] ?? 'tabel')}: kalau saringan memastikan tidak ada pasangan JOIN, pencarian ke tabel ini dilewati. Pada INNER JOIN baris itu dibuang; pada LEFT JOIN baris itu tetap dipertahankan dan diisi NULL.`,
      ),
  },
  {
    pattern: /^CREATE BLOOM FILTER$/i,
    build: () => base('bloom-filter', 'info', 'Bloom filter', 'Membuat saringan cepat dari hasil subquery agar pengecekan keanggotaan (IN) lebih hemat.'),
  },
  {
    pattern: /^CORRELATED (SCALAR|LIST) SUBQUERY(?:\s+(\d+))?$/i,
    build: (m) => ({
      ...base(
        'structure',
        'info',
        `Subquery berkorelasi${m[2] ? ` #${m[2]}` : ''}`,
        'Subquery ini memakai kolom dari query luar, jadi dijalankan ulang untuk SETIAP baris query luar. Pastikan langkah di dalamnya berupa SEARCH lewat index; kalau SCAN, biayanya berlipat.',
      ),
      correlated: true,
    }),
  },
  {
    pattern: /^SCALAR SUBQUERY(?:\s+(\d+))?$/i,
    build: (m) => base('structure', 'neutral', `Subquery skalar${m[1] ? ` #${m[1]}` : ''}`, 'Subquery yang menghasilkan satu nilai; dijalankan sekali lalu hasilnya dipakai ulang.'),
  },
  {
    pattern: /^LIST SUBQUERY(?:\s+(\d+))?$/i,
    build: (m) =>
      base('structure', 'neutral', `Subquery daftar${m[1] ? ` #${m[1]}` : ''}`, 'Subquery untuk IN (…): dijalankan sekali, hasilnya disimpan sementara untuk dicek keanggotaannya.'),
  },
  {
    // SQLite ≥3.45: daftar IN (…) yang sama dipakai di beberapa tempat (mis. setelah query diratakan) tidak dihitung ulang.
    pattern: /^REUSE (?:LIST|SCALAR) SUBQUERY(?:\s+(\d+))?$/i,
    build: (m) =>
      base(
        'structure',
        'neutral',
        `Pakai ulang subquery${m[1] ? ` #${m[1]}` : ''}`,
        'Hasil subquery yang sama sudah dihitung sebelumnya di query ini, jadi SQLite memakai ulang hasilnya tanpa menjalankannya lagi.',
      ),
  },
  {
    pattern: /^CO-ROUTINE (.+)$/i,
    build: (m) =>
      base(
        'structure',
        'neutral',
        'Co-routine',
        `${coroutineLabel(m[1] ?? '')} dihasilkan "sambil jalan": barisnya dibuat satu per satu saat dibutuhkan query luar, tanpa disimpan seluruhnya dulu.`,
      ),
  },
  {
    pattern: /^MATERIALIZE (.+)$/i,
    build: (m) =>
      base('structure', 'neutral', 'Materialize', `${coroutineLabel(m[1] ?? '')} dihitung sekali lalu disimpan di tabel sementara, kemudian dibaca oleh query luar.`),
  },
  {
    pattern: /^COMPOUND QUERY$/i,
    build: () => base('structure', 'neutral', 'Gabungan query', 'Beberapa SELECT digabung (UNION/UNION ALL/EXCEPT/INTERSECT); tiap bagian dijalankan bergiliran.'),
  },
  {
    pattern: /^LEFT-MOST SUBQUERY$/i,
    build: () => base('structure', 'neutral', 'SELECT pertama', 'Bagian SELECT paling kiri dari gabungan query.'),
  },
  {
    pattern: /^(UNION ALL|UNION|EXCEPT|INTERSECT)(?:\s+USING TEMP B-TREE)?$/i,
    build: (m) => {
      const op = (m[1] ?? '').toUpperCase();
      const note = op === 'UNION ALL' ? 'hasilnya langsung disambung tanpa membuang duplikat.' : 'hasilnya dicocokkan lewat B-tree sementara.';
      return base('structure', 'neutral', op, `Bagian SELECT berikutnya (${op}): ${note}`);
    },
  },
  {
    pattern: /^MERGE \((.+)\)$/i,
    build: (m) =>
      base('structure', 'neutral', `Merge ${m[1] ?? ''}`.trim(), `Kedua sisi ${m[1] ?? 'gabungan'} sudah urut, jadi hasilnya digabung sambil berjalan (merge) sekaligus membuang duplikat.`),
  },
  {
    pattern: /^(LEFT|RIGHT)$/i,
    build: (m) => base('structure', 'neutral', `Sisi ${(m[1] ?? '').toLowerCase() === 'left' ? 'kiri' : 'kanan'}`, 'Salah satu sisi gabungan query.'),
  },
  {
    pattern: /^MULTI-INDEX OR$/i,
    build: () => base('structure', 'info', 'OR dengan beberapa index', 'Kondisi OR dipecah: setiap sisi OR dicari dengan index-nya sendiri, lalu hasilnya digabung tanpa duplikat.'),
  },
  {
    pattern: /^INDEX (\d+)$/i,
    build: (m) => base('structure', 'neutral', `Cabang OR #${m[1] ?? ''}`, 'Satu sisi dari kondisi OR.'),
  },
  {
    pattern: /^SETUP$/i,
    build: () => base('structure', 'neutral', 'Anchor CTE rekursif', 'Bagian awal (anchor) CTE rekursif — dijalankan sekali sebagai titik mulai.'),
  },
  {
    pattern: /^RECURSIVE STEP$/i,
    build: () => base('structure', 'neutral', 'Langkah rekursif', 'Bagian rekursif CTE — diulang terus memakai baris hasil putaran sebelumnya sampai tidak ada baris baru.'),
  },
  {
    pattern: /^RIGHT-JOIN (.+)$/i,
    build: (m, tableName) =>
      base('structure', 'neutral', 'Sisa RIGHT/FULL JOIN', `Langkah tambahan RIGHT/FULL JOIN: mencari baris ${tableName(m[1] ?? '')} yang tidak punya pasangan, lalu menambahkannya (sisi lain diisi NULL).`),
  },
];

export function classifyDetail(detail: string, ctx: ClassifyContext): Classified {
  const trimmed = detail.trim();
  if (CONSTANT_ROW.test(trimmed)) {
    return {
      ...base('derived-scan', 'neutral', 'Baris konstan', 'Tidak membaca tabel apa pun — hanya menghasilkan baris konstan (mis. SELECT 1, VALUES, atau anchor CTE rekursif).'),
      access: true,
    };
  }
  const access = classifyAccess(trimmed, ctx);
  if (access) return access;
  const inOperator = classifyInOperator(trimmed, ctx);
  if (inOperator) return inOperator;
  const tableName = (name: string): string => {
    const lower = name.toLowerCase();
    const direct = ctx.schema.tables.get(lower);
    if (direct) return direct.name;
    const entry = ctx.scope.aliases.get(lower);
    const distinct = entry ? unique(entry.all.map((o) => o.table)) : [];
    return distinct.length === 1 ? (distinct[0] ?? name) : name;
  };
  for (const rule of STRUCTURE_RULES) {
    const match = rule.pattern.exec(trimmed);
    if (match) return rule.build(match, tableName);
  }
  return base('other', 'neutral', 'Langkah lain', 'Langkah plan yang belum dijelaskan di aplikasi ini — lihat teks aslinya.');
}
