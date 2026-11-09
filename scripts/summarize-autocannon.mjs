// Résume une sortie `autocannon --json` (fichier en argument, ou entrée standard).
//   npx autocannon -c 10 -d 15 --json http://localhost:3000/api/orders/ORD-102/availability > run.json
//   npm run summarize -- run.json
// Autocannon ne fournit pas p95 : on affiche p90 et p97,5 qui l'encadrent.
import { readFileSync } from 'node:fs';

const source = process.argv[2];
let buffer;
try {
  buffer = readFileSync(source ?? 0);
} catch (error) {
  console.error(`Lecture impossible : ${error.message}`);
  process.exit(1);
}
// Redirection Windows PowerShell 5.1 : fichier en UTF-16 LE avec BOM.
const text = buffer[0] === 0xff && buffer[1] === 0xfe ? buffer.toString('utf16le') : buffer.toString('utf8');
let result;
try {
  result = JSON.parse(text.replace(/^﻿/, ''));
} catch {
  console.error('Entrée non JSON : relancez autocannon avec --json et ne redirigez que la sortie standard.');
  process.exit(1);
}
const { latency, requests } = result;
console.log(
  [
    `connexions=${result.connections}`,
    `durée=${result.duration}s`,
    `p50=${latency.p50}ms`,
    `p90=${latency.p90}ms`,
    `p97.5=${latency.p97_5}ms`,
    `p99=${latency.p99}ms`,
    `req/s(moy)=${requests.average}`,
    `2xx=${result['2xx']}`,
    `non2xx=${result.non2xx}`,
    `erreurs=${result.errors}`,
    `timeouts=${result.timeouts}`,
  ].join('  '),
);
