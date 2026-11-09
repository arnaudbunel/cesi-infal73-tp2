import { buildStockApp } from './app.js';
import { readStockConfig } from './config.js';

let config;
try {
  config = readStockConfig();
} catch (error) {
  console.error(`[stock-service] invalid configuration: ${(error as Error).message}`);
  process.exit(1);
}

// Simulateur de pannes : usage laboratoire uniquement.
if (process.env['NODE_ENV'] === 'production') {
  console.error('[stock-service] refusing to start: the fault simulator is forbidden when NODE_ENV=production');
  process.exit(1);
}

const server = buildStockApp(config);

server.listen(config.port, config.host, () => {
  console.log(
    `[stock-service] listening on http://${config.host}:${config.port} ` +
      `mode=${config.mode} latencyMs=${config.latencyMs} available=${config.available}`,
  );
  if (config.mode !== 'normal') console.warn(`[stock-service] FAULT MODE ACTIVE: ${config.mode}`);
});

server.on('error', (error) => {
  console.error(`[stock-service] ${error.message}`);
  process.exit(1);
});

function shutdown(): void {
  server.close(() => process.exit(0));
  server.closeAllConnections();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
