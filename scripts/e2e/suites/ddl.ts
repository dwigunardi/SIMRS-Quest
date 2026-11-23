/**
 * Tier 9 (DDL): penilaian 'schema' lewat worker di UI — chip penilaian, struktur yang salah ditampilkan berdampingan,
 * uji perilaku yang gagal disebut nomornya, jawaban benar, materi "Konsep baru", Final Boss di peta, dan Peta Kelemahan.
 */
import { MISSIONS } from '../../../src/data/missions';
import { PROGRESS_KEY, progressWith, type SuiteContext } from '../context';

const BEFORE_TIER9 = MISSIONS.filter((m) => m.tier < 9).map((m) => m.id);
const TABLE_HEAD = `CREATE TABLE jadwal_praktik (
  id_jadwal INTEGER PRIMARY KEY,
  id_dokter TEXT NOT NULL REFERENCES dokter (id_dokter),`;
const TABLE_TAIL = `  jam_mulai TEXT NOT NULL,
  jam_selesai TEXT NOT NULL,
  kuota INTEGER NOT NULL DEFAULT 20 CHECK (kuota > 0),
  CHECK (jam_selesai > jam_mulai)`;
const INSERTS = `INSERT INTO jadwal_praktik (id_dokter, hari, jam_mulai, jam_selesai, kuota) VALUES ('D001', 'Senin', '08:00', '12:00', 25);
INSERT INTO jadwal_praktik (id_dokter, hari, jam_mulai, jam_selesai) VALUES ('D007', 'Rabu', '13:00', '16:00');`;
const HARI_OK = "  hari TEXT NOT NULL CHECK (hari IN ('Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu')),";

const NO_UNIQUE = `${TABLE_HEAD}\n${HARI_OK}\n${TABLE_TAIL}\n);\n${INSERTS}`;
const NO_CHECK_HARI = `${TABLE_HEAD}\n  hari TEXT NOT NULL,\n${TABLE_TAIL},\n  UNIQUE (id_dokter, hari)\n);\n${INSERTS}`;
const RIGHT = `${TABLE_HEAD}\n${HARI_OK}\n${TABLE_TAIL},\n  UNIQUE (id_dokter, hari)\n);\n${INSERTS}`;

export async function ddlSuite(t: SuiteContext): Promise<void> {
  const run = (sql: string) => t.evaluate(`__t.setSql(${JSON.stringify(sql)}); __t.tick().then(() => __t.click('Run & Check'))`);

  await t.fresh({ [PROGRESS_KEY]: progressWith([...BEFORE_TIER9, 't9-normalisasi'], 't9-create-table') });
  t.check('misi 57 (CREATE TABLE) terbuka', await t.evaluate(`__t.waitText('Jadwal Praktik Dokter', 20000)`));
  t.check('chip penilaian struktur + 9 uji perilaku', await t.evaluate(`__t.has('Penilaian: struktur jadwal_praktik') && __t.has('9 uji perilaku')`));
  t.check('tanpa tombol Urutan Eksekusi (bukan misi SELECT)', await t.evaluate(`__t.buttons('Urutan Eksekusi').length === 0`));
  t.check('penanda "Konsep baru: CREATE TABLE & Constraint"', await t.evaluate(`__t.has('Konsep baru: CREATE TABLE & Constraint')`));

  await run(NO_UNIQUE);
  t.check('struktur salah → kartu "Desain tabel belum sesuai"', await t.evaluate(`__t.waitText('Desain tabel belum sesuai', 15000)`));
  t.check('pesan menyebut UNIQUE yang belum ada', await t.evaluate(`__t.has('UNIQUE yang belum ada: (hari, id_dokter)')`));
  t.check('struktur ditampilkan berdampingan', await t.evaluate(`(async () => { const tab = [...document.querySelectorAll('button')].find(b => /Struktur jadwal_praktik/.test(b.innerText) || b.innerText.trim() === 'Berdampingan'); tab?.click(); await __t.tick(300); return __t.has('Struktur jadwal_praktik — skripmu') || __t.has('afinitas'); })()`));

  await run(NO_CHECK_HARI);
  t.check('CHECK hilang → uji perilaku #3 (hari Minggu) disebut', await t.evaluate(`__t.waitText('Uji perilaku #3', 15000)`), await t.evaluate(`(__t.text().match(/Uji perilaku #\\d[^.]*\\./) ?? [''])[0]`));
  t.check('pesan: seharusnya DITOLAK, tetapi diterima', await t.evaluate(`__t.has('seharusnya DITOLAK, tetapi di tabelmu diterima')`));

  await run(RIGHT);
  t.check('jawaban benar → misi selesai', await t.evaluate(`__t.waitText('Jawaban benar!', 15000)`));
  t.check('XP misi tier 9 (+250)', await t.evaluate(`__t.text().includes('+250 XP')`));

  await t.evaluate(`(() => { const b = [...document.querySelectorAll('button[aria-expanded]')].find(x => x.innerText.includes('Tier 9:')); if (b && b.getAttribute('aria-expanded') !== 'true') b.click(); return true; })()`);
  await t.sleep(300);
  t.check('boss tier 9 bukan lagi Final Boss (Final Boss pindah ke tier terakhir)', await t.evaluate(`!!__t.node('Boss: Modul Rawat Inap') && !__t.node('Final Boss: Modul Rawat Inap')`));

  await t.evaluate(`__t.mode('Progres')`);
  t.check('Peta Kelemahan: kategori "Desain tabel & DDL"', await t.evaluate(`__t.waitText('Desain tabel & DDL', 5000)`));
}
