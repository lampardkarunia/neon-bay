// NEON BAY — HEAT: entri gta6-01 yang bisa dijalankan (Node 22, pustaka standar saja).
// Permainan itu sendiri adalah folder game/ di samping berkas ini: berkas statis polos
// yang dibuka browser desktop secara offline (game/index.html beserta modul ES-nya,
// tanpa pustaka dan tanpa permintaan jaringan). Program ini menyerahkannya: menyalin
// game/ dan screenshots/ ke folder keluaran, lalu menulis dossier.json — ringkasan
// yang dibaca penilai — memakai pustaka make.fun yang ter-vendor di repo.
// NEON BAY adalah gim kejahatan dunia-terbuka 2D dari atas: Jax Marlowe mengemudi,
// berkelahi, dan menjalankan misi keliling kota orisinal Neon Bay sementara polisi
// memburunya berdasarkan meter wanted. Untuk mencoba lokal: `node serve.ts`,
// lalu buka http://localhost:8080.
// Di luar kontainer penilai, MAKEFUN_OUTPUT_DIR menggantikan /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { chmodSync, cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Folder keluaran sendiri tidak pernah dihapus (bisa jadi mount atau milik pemanggil);
// folder itu dibuat bila belum ada, lalu isinya dibersihkan satu per satu. Setiap berkas
// dibuat bisa-tulis dulu supaya salinan baca-saja dari run sebelumnya tidak menghalangi.
mkdirSync(out, { recursive: true });
for (const child of readdirSync(out)) {
  const target = join(out, child);
  const makeWritable = (p) => {
    try { chmodSync(p, 0o755); } catch { /* usaha terbaik; rmSync akan melaporkan kegagalan nyata */ }
    const st = statSync(p);
    if (st.isDirectory()) for (const sub of readdirSync(p)) makeWritable(join(p, sub));
  };
  makeWritable(target);
  rmSync(target, { recursive: true, force: true });
}

cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// Batas dari penilai (reference/gate.json): hanya text_max_bytes yang membentuk isi berkas;
// batas lain menolak entri yang pasti ditolak penilai (lebih dari 4 screenshot atau satu
// screenshot di atas 256 KiB; lebih dari 993 berkas game/ atau 48 MiB total berkas game,
// atau path di bawah game/ melebihi 1000 byte: game/ dihitung di samping batas 1000 entri
// milik /output sendiri, screenshots/-nya, dan dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
