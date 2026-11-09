# INFAL73 — Partie 3 — TP2 : communication REST non bloquante et analyse des performances

Master 1 MAALSI · groupes de 2 à 4 · 1 h 45. Prolongement direct du TP1 (API Commandes : Node.js, TypeScript, Fastify).

## Prérequis
- Node.js 24 LTS (`nvm use` lit `.nvmrc`), npm ≥ 10. Aucun compte, cloud ou secret.
- Un client HTTP (`curl`, `docs/requests.http` avec l'extension REST Client de VS Code).

## Démarrage
```bash
npm ci
npm run dev        # Stocks sur :3001 et Commandes sur :3000 (127.0.0.1)
npm test           # tests de fonctionnement : doivent rester verts
npm run test:acceptance   # contrat cible : des échecs sont attendus au départ
```
Autres commandes : `npm run typecheck`, `npm run build`, `npm run dev:orders`, `npm run dev:stocks` (deux terminaux), `npm run reset` (nettoie `dist/`, vérifie les ports ; les données sont en mémoire et repartent à neuf à chaque démarrage).

## Architecture
```
apps/order-service/   API Commandes (TP1 conservé + extension TP2), port 3000
apps/stock-service/   Simulateur Stocks reproductible, port 3001
tests/smoke/          tests verts (TP1 conservé, Stocks, diagnostics, availability nominale)
tests/acceptance/     contrat cible de la nouvelle route
docs/                 mise en route, protocole, relevé de mesures, compte rendu
```
Commandes ↔ Stocks : vrai HTTP local. Données : `ORD-101` CREATED, `ORD-102` CONFIRMED (P12 × 2), `ORD-103` SHIPPED, `ORD-104` CANCELLED ; Stocks fournit 12 unités de P12.

## Nouveautés du TP2
| Route | Rôle |
|---|---|
| `GET /api/diagnostics/blocking` | ≈ 300 ms d'attente active sur le thread principal → `{"mode":"blocking"}` |
| `GET /api/diagnostics/nonblocking` | `await setTimeout(300)` → `{"mode":"nonblocking"}` |
| `GET /api/orders/:id/availability` | consulte Stocks (lecture seule) : `{orderId, productId, requestedQuantity, available, canFulfill}` |

Règle pédagogique : l'article de référence d'une commande est sa **première ligne**. Les deux routes `diagnostics` n'existent pas quand `NODE_ENV=production`.

Simulateur Stocks (variables d'environnement, lues au démarrage) :

| Variable | Défaut | Valeurs |
|---|---|---|
| `STOCK_PORT` | 3001 | port TCP |
| `STOCK_LATENCY_MS` | 50 | entier 1 à 60000 (ex. 50, 300, 1000, 3000) |
| `STOCK_MODE` | `normal` | `normal`, `status503`, `invalid_json`, `disconnect` |
| `STOCK_AVAILABLE` | 12 | entier ≥ 0 |
| `STOCK_HOST` | 127.0.0.1 | |

Côté Commandes : `PORT`, `HOST` (127.0.0.1 par défaut), `STOCK_BASE_URL` (`http://127.0.0.1:3001`).
Exemple : `STOCK_MODE=status503 npm run dev` (PowerShell : `$env:STOCK_MODE="status503"; npm run dev`).

### Changer `STOCK_MODE` / `STOCK_LATENCY_MS` (arrêter avec Ctrl+C, puis relancer)
Les variables sont lues **au démarrage** : pour changer de configuration, redémarrez Stocks.

| Cas | Bash (Linux/macOS/Git Bash) | PowerShell (Windows, une ligne) |
|---|---|---|
| nominal 50 ms | `STOCK_LATENCY_MS=50 npm run dev` | `$env:STOCK_LATENCY_MS="50"; npm run dev` |
| latence 300 / 1000 / 3000 ms | `STOCK_LATENCY_MS=3000 npm run dev` | `$env:STOCK_LATENCY_MS="3000"; npm run dev` |
| Stocks répond 503 | `STOCK_MODE=status503 npm run dev` | `$env:STOCK_MODE="status503"; npm run dev` |
| JSON invalide | `STOCK_MODE=invalid_json npm run dev` | `$env:STOCK_MODE="invalid_json"; npm run dev` |
| coupure pendant le corps | `STOCK_MODE=disconnect npm run dev` | `$env:STOCK_MODE="disconnect"; npm run dev` |
| connexion refusée | `npm run dev:orders` (sans Stocks) | `npm run dev:orders` (sans Stocks) |

PowerShell : les variables restent dans la session ; revenez au nominal avec `Remove-Item Env:STOCK_MODE, Env:STOCK_LATENCY_MS`. Bash : `unset STOCK_MODE STOCK_LATENCY_MS`.

## Incidents à reproduire et mesurer (F1 à F5)
| Incident | Comment le provoquer | À relever |
|---|---|---|
| F1 | `STOCK_LATENCY_MS=3000` | statut, durée totale de la réponse |
| F2 | `STOCK_MODE=status503` | statut, `Content-Type`, corps |
| F3 | Stocks arrêté | statut, `Content-Type`, corps |
| F4 | `STOCK_MODE=invalid_json` (et corps de contenu invalide via les tests) | statut, corps |
| F5 | `STOCK_MODE=disconnect` (en-têtes reçus, corps coupé) | statut, aucun succès partiel |

## Mesures de charge
Autocannon est installé par `npm ci` et se lance **dans un autre terminal que les serveurs** (une seule ligne, Windows PowerShell compris) :
```powershell
npx autocannon -c 10 -d 15 --json http://localhost:3000/api/orders/ORD-102/availability
```
Scénarios S1 à S5 (latence Stocks / connexions) : S1 50 ms / 1 · S2 300 ms / 1 · S3 300 ms / 10 · S4 300 ms / 50 · S5 1000 ms / 10. Tableaux vierges dans `docs/measurement-template.md` ; protocole dans `docs/experiment-protocol.md`. Aucune valeur de référence n'est fournie : vous mesurez.

## Compte rendu et évaluation
Rendez `docs/compte-rendu-template.md` (copie remplie). Traces minimales par expérience : **prédiction** (avant), **commande** exacte, **réponse/log** brut, **interprétation**, **recommandation**.
Grille formative : Fonctionnement 25 % · Expérimentation 30 % · Justification 25 % · Maîtrise individuelle 20 %. Un point individuel (question ou changement de situation imprévu) a lieu à la restitution. Le quiz 2A est hors de ces 105 minutes.
La connexion refusée (F3) s'obtient en arrêtant Stocks (`npm run dev:orders` seul) ou en pointant `STOCK_BASE_URL` vers un port inutilisé.

## Contrat cible de `GET /api/orders/:id/availability`
L'implémentation finalisée doit :
- utiliser des I/O HTTP asynchrones ;
- appliquer un **budget total de 2 000 ms**, lecture du corps de réponse comprise ;
- valider le JSON Stocks : objet non null, `productId` égal au produit demandé, `available` entier fini ≥ 0 ;
- calculer `canFulfill = available >= requestedQuantity` côté Commandes ;
- ne jamais exposer d'exception interne et répondre en `application/problem+json` :

| Incident | Situation | Réponse attendue |
|---|---|---|
| F1 | Stocks répond en 3 s | 504 Gateway Timeout |
| F2 | Stocks répond 503 | 503 Service Unavailable |
| F3 | connexion refusée | 502 Bad Gateway |
| F4 | JSON malformé ou schéma invalide | 502 Bad Gateway |
| F5 | réponse coupée en cours | 502 (ou 504 si le délai total expire) |

Aucun retry automatique n'est exigé ; une réponse partielle n'est jamais un succès ; commande inconnue : 404 `problem+json` (contrat TP1).

## Lire correctement l'expérience
- Le `setTimeout()` de 300 ms de la route `nonblocking` **n'est pas une vraie opération HTTP** : il isole l'effet d'une attente asynchrone. Le simulateur Stocks, lui, est un vrai serveur HTTP local, avec sa propre latence configurée.
- `-c 10` d'Autocannon = **10 connexions concurrentes** côté client, et non 10 threads du serveur : le code JavaScript de Commandes s'exécute sur un seul thread.
- Autocannon ne donne pas de p95 : relevez p90 et p97,5 (`npm run summarize -- run.json`).
- Mesurez avec Autocannon dans **un autre processus** que les serveurs ; une mesure sur machine chargée ou avec des serveurs en mode `watch` n'est pas comparable à une autre.
- Si `localhost` ne répond pas sous Windows (résolution IPv6), utilisez `127.0.0.1` dans l'URL.

## Déroulé (105 min)
Démarrage 8 · Diagnostic 12 · HTTP 20 · Mesures 25 · Incidents 25 · Restitution 15. Voir `docs/experiment-protocol.md`.

## Démarche et IA
Pour chaque expérience : **prédiction → test → observation → interprétation**. Les assistants IA sont autorisés ; ils ne remplacent pas vos preuves expérimentales : chaque affirmation de votre restitution s'appuie sur une mesure ou une sortie de test que vous avez produite. N'inventez aucun chiffre.

## Sécurité
Les routes de diagnostic et les modes de panne sont **exclusivement pédagogiques** : réseau local uniquement, jamais en production.
