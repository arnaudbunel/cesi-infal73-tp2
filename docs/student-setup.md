# Mise en route (≈ 8 min)

1. `node -v` → v24.x. Sinon `nvm use` (Linux/macOS) ou installez Node 24 LTS (Windows).
2. `npm ci`
3. `npm test` → tout doit être vert.
4. `npm run dev` → deux lignes de démarrage `[stocks] … mode=normal latencyMs=… available=12` et `[orders] Server listening …`.
5. Vérifiez :
   ```bash
   curl http://localhost:3001/stock/P12
   curl http://localhost:3000/api/orders/ORD-102/availability
   ```
   (PowerShell : `curl` est un alias de `Invoke-WebRequest` ; utilisez `curl.exe` ou `Invoke-RestMethod`.)
6. `npm run test:acceptance` : notez quels tests échouent (c'est normal) avant de modifier quoi que ce soit.

Changer la configuration de Stocks = arrêter (Ctrl+C) puis relancer avec d'autres variables.
- Bash : `STOCK_LATENCY_MS=300 npm run dev`
- PowerShell : `$env:STOCK_LATENCY_MS="300"; npm run dev` (puis `Remove-Item Env:STOCK_LATENCY_MS`)

Port occupé ? `npm run reset` indique quels ports (3000, 3001) sont pris.
