# Protocole d'expérience

## Phases (105 min)
| Phase | Durée | Contenu |
|---|---:|---|
| Démarrage | 8 | installation, tests, première requête |
| Diagnostic | 12 | comparer `diagnostics/blocking` et `nonblocking` |
| HTTP | 20 | travailler `/availability` face au contrat cible |
| Mesures | 25 | campagne S1 à S5 |
| Incidents | 25 | F1 à F5 : observer, classifier, tester |
| Restitution | 15 | synthèse argumentée |

## Consigne de phase : prédire → expérimenter → expliquer
- **Démarrage (8 min)** : prédisez quels tests de `npm run test:acceptance` échouent ; lancez-les ; expliquez chaque échec en une phrase.
- **Diagnostic (12 min)** : prédisez le temps de 5 requêtes simultanées sur `blocking` puis `nonblocking` ; mesurez ; expliquez.
- **HTTP réel (20 min)** : prédisez la réponse de `/availability` pour chaque incident ; testez ; expliquez l'écart avec le contrat du README.
- **Mesures (25 min)** : écrivez vos hypothèses S1 à S5 ; mesurez ; expliquez les écarts.
- **Incidents (25 min)** : prédisez statut et durée pour F1 à F5 ; provoquez-les ; expliquez ; recommandez.
- **Restitution (15 min)** : présentez une conclusion limitée à ce que vous avez mesuré.

## Démarche (pour chaque expérience)
1. **Prédiction** écrite avant d'exécuter (valeur ou ordre de grandeur, et pourquoi) ;
2. **Test** : commande exacte, configuration complète ;
3. **Observation** : sortie brute conservée ;
4. **Interprétation** : écart avec la prédiction, mécanisme expliquant l'écart.

Une IA peut aider à comprendre ou rédiger, jamais à tenir lieu de preuve : seules vos mesures comptent.

## Campagne de mesure
| Scénario | Latence Stocks | Connexions |
|---|---:|---:|
| S1 | 50 ms | 1 |
| S2 | 300 ms | 1 |
| S3 | 300 ms | 10 |
| S4 | 300 ms | 50 |
| S5 | 1000 ms | 10 |

1. Lancez Stocks avec la latence voulue (`STOCK_LATENCY_MS`), puis Commandes.
2. Entre deux configurations, arrêtez (Ctrl+C) puis relancez Stocks (et Commandes si besoin) : `STOCK_LATENCY_MS` est lu au démarrage.
3. **Autocannon tourne dans un autre terminal/processus que le serveur.**
4. Échauffement court (par ex. `-d 3`, résultat ignoré), puis 15 s d'observation, si possible 3 répétitions.
5. Commande (une seule ligne, PowerShell compris ; adaptez `-c`) :
   ```powershell
   npx autocannon -c 10 -d 15 --json http://localhost:3000/api/orders/ORD-102/availability
   ```
6. Écrivez d'abord vos hypothèses (tableau en bas de `docs/measurement-template.md`), puis relevez p50, p90, p97,5 (Autocannon ne fournit pas p95), req/s, erreurs (et non-2xx) et la configuration dans une copie du modèle. Enregistrez la sortie JSON (`> run.json`) puis `npm run summarize -- run.json` ; sous Windows PowerShell 5.1 le fichier est en UTF-16, le script le gère.
7. Ne comparez que des mesures prises dans les mêmes conditions (même machine, mêmes processus ouverts).

Pour comparer les routes de diagnostic : mêmes `-c`/`-d` sur `/api/diagnostics/blocking` puis `/nonblocking`.

## Incidents F1 à F5
Reproduisez chaque incident avec `STOCK_LATENCY_MS=3000`, `STOCK_MODE=status503`, arrêt de Stocks, `STOCK_MODE=invalid_json`, `STOCK_MODE=disconnect`. Consignez statut, `Content-Type` et corps, puis comparez au contrat du README.
