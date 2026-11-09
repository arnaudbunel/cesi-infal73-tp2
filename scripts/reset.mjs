// Remet le dépôt dans un état propre. Les données des services sont en mémoire :
// elles sont réinitialisées à chaque (re)démarrage, il suffit donc d'arrêter puis relancer `npm run dev`.
import { rmSync } from 'node:fs';
import { createConnection } from 'node:net';

for (const dir of ['apps/order-service/dist', 'apps/stock-service/dist']) {
  rmSync(new URL(`../${dir}`, import.meta.url), { recursive: true, force: true });
  console.log(`removed ${dir}`);
}

const inUse = (port) =>
  new Promise((resolve) => {
    const socket = createConnection({ port, host: '127.0.0.1' });
    socket.once('connect', () => (socket.destroy(), resolve(true)));
    socket.once('error', () => resolve(false));
  });

for (const port of [3000, 3001]) {
  console.log(`port ${port}: ${(await inUse(port)) ? 'OCCUPÉ - arrêtez le processus (Ctrl+C) puis relancez npm run dev' : 'libre'}`);
}
