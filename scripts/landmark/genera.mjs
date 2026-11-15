// Rigenera le illustrazioni dei luoghi simbolo: esegue ogni generatore in luoghi/*.mjs, che
// scrive public/landmarks/<id>.svg. Uso: npm run illustrazioni [id ...]
// Con uno o più id rigenera solo quelli. Non tocca indice.json: larghezzaMetri e ancora
// vanno aggiornati a mano quando cambia il viewBox (vedi README).
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = dirname(fileURLToPath(import.meta.url));
const LUOGHI = join(QUI, 'luoghi');
const USCITA = join(QUI, '..', '..', 'public', 'landmarks');
const tutti = readdirSync(LUOGHI).filter((f) => f.endsWith('.mjs')).map((f) => f.slice(0, -4)).sort();
const scelti = process.argv.slice(2);
for (const id of scelti) {
  if (!tutti.includes(id)) {
    console.error(`Generatore sconosciuto: ${id}. Disponibili: ${tutti.join(', ')}`);
    process.exit(1);
  }
}
for (const id of scelti.length > 0 ? scelti : tutti) {
  const file = join(USCITA, `${id}.svg`);
  execFileSync(process.execPath, [join(LUOGHI, `${id}.mjs`), file], { stdio: ['ignore', 'ignore', 'inherit'] });
  const svg = readFileSync(file, 'utf8');
  const riquadro = /viewBox="([^"]+)"/.exec(svg)?.[1] ?? '?';
  console.log(`${id.padEnd(18)} ${(svg.length / 1024).toFixed(1).padStart(5)} KB  viewBox ${riquadro}`);
}
