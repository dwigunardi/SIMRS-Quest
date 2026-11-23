/**
 * Materi umum yang berlaku untuk semua query.
 */
import type { Article } from '../../types';

export const ARTICLES_UMUM: Article[] = [
  {
    id: 'urutan-eksekusi',
    title: 'Urutan Eksekusi Query',
    summary: 'Query ditulis mulai dari SELECT, tetapi database menjalankannya mulai dari FROM — ini kunci memahami WHERE, GROUP BY, HAVING, dan alias.',
    tier: 1,
    missions: ['t1-predict-distinct', 't2-predict-having', 't3-predict-count', 't2-having'],
    sections: [
      {
        heading: 'Ditulis vs dijalankan',
        body: `Kita menulis query dengan urutan \`SELECT … FROM … WHERE … GROUP BY … HAVING … ORDER BY … LIMIT\`. Database **tidak** menjalankannya dari atas ke bawah. Urutan logisnya:

- **FROM** (dan JOIN): kumpulkan semua baris dari tabel sumber
- **WHERE**: buang baris yang tidak memenuhi syarat, satu per satu
- **GROUP BY**: kumpulkan baris yang nilainya sama ke dalam grup
- **HAVING**: buang GRUP yang tidak memenuhi syarat
- **SELECT**: hitung kolom/ekspresi dan beri alias
- **DISTINCT**: buang baris hasil yang kembar
- **ORDER BY**: urutkan
- **LIMIT**: ambil sebagian baris

Setiap tahap hanya melihat hasil tahap sebelumnya. Dari urutan ini banyak aturan SQL jadi masuk akal tanpa perlu dihafal.`,
        examples: [
          {
            title: 'Satu query, semua tahap',
            sql: `SELECT kota, COUNT(*) AS jumlah_pasien
FROM pasien
WHERE jenis_kelamin = 'P'
GROUP BY kota
HAVING COUNT(*) >= 3
ORDER BY jumlah_pasien DESC, kota;`,
            note: 'Klik **Urutan Eksekusi** untuk melihat isi tabel di setiap tahap: 20 pasien → 10 pasien perempuan → 4 grup kota → 2 kota yang punya ≥ 3 pasien perempuan.',
          },
        ],
      },
      {
        heading: 'Akibat yang sering membingungkan',
        body: `- **Alias SELECT tidak bisa dipakai di WHERE** (menurut standar SQL), karena WHERE berjalan sebelum SELECT memberi nama alias. SQLite kebetulan mengizinkannya, tetapi SQL Server, MySQL, PostgreSQL, dan Oracle akan menolak.
- **Alias SELECT boleh dipakai di ORDER BY**, karena ORDER BY berjalan setelah SELECT.
- **COUNT/SUM/AVG tidak boleh di WHERE**: saat WHERE berjalan, grup belum terbentuk. Saringan berbasis agregat ditulis di HAVING.
- **LIMIT tanpa ORDER BY** mengambil baris "yang kebetulan pertama" — urutannya tidak dijamin.
- **Window function** (\`… OVER (…)\`) dihitung di tahap SELECT, jadi hasilnya tidak bisa disaring di WHERE pada query yang sama.`,
        examples: [
          {
            title: 'Alias dipakai di ORDER BY (aman di semua DBMS)',
            sql: `SELECT nama_poli, gedung AS lokasi
FROM poliklinik
ORDER BY lokasi, nama_poli;`,
          },
        ],
      },
    ],
    pitfalls: [
      'Menulis `WHERE COUNT(*) > 1` — agregat belum ada saat WHERE berjalan; pakai HAVING.',
      'Mengandalkan alias SELECT di WHERE karena "jalan di SQLite", lalu query gagal saat dipindah ke SQL Server/PostgreSQL.',
      'Mengira LIMIT memotong data sebelum ORDER BY — padahal LIMIT selalu tahap terakhir.',
    ],
    dialects: [
      {
        label: 'Alias SELECT di WHERE',
        syntax: {
          sqlite: 'diizinkan (ekstensi SQLite)',
          sqlServer: 'error: Invalid column name',
          mysql: 'error: Unknown column',
          postgresql: 'error: column does not exist',
          oracle: 'error: invalid identifier',
        },
        note: 'Agar portabel, ulangi ekspresinya di WHERE atau bungkus query dengan subquery/CTE.',
      },
      {
        label: 'Alias SELECT di GROUP BY',
        syntax: {
          sqlite: 'diizinkan',
          sqlServer: 'tidak diizinkan',
          mysql: 'diizinkan',
          postgresql: 'diizinkan',
          oracle: 'diizinkan sejak 23ai',
        },
      },
    ],
  },
];
