# ADR 0003 — Base de données : SQLite via `node:sqlite`

| | |
|---|---|
| **Statut** | Accepté |
| **Date** | 2026-09-17 |
| **Issue** | #9 — Base de données locale des métadonnées |

## Contexte

EPIKODI doit stocker la bibliothèque (fichiers, films, séries, musique, podcasts), l'état de
lecture (reprise, vu, favoris, notes) et les réglages, de façon persistante, rapide sur plusieurs
milliers d'entrées, avec des migrations de schéma sans perte. L'issue recommandait SQLite.

## Options

| Option | Pour | Contre |
|---|---|---|
| **`node:sqlite`** (module intégré à Node ≥ 22.13, Electron 44 embarque Node 24) | Aucune dépendance, **aucun module natif à recompiler pour l'ABI Electron**, API synchrone simple, SQLite 3.53 avec FTS5, JSON et `VACUUM INTO` (vérifié dans Electron 44) | API encore marquée « stable 1.x » récemment ; Node ≥ 24 requis pour les tests hors Electron |
| `better-sqlite3` | Mûr, très rapide | Module natif : `electron-rebuild` sur chaque OS et à chaque montée d'Electron — source classique de pannes de build |
| `sql.js` (WASM) | Portable | Base entière en mémoire, persistance manuelle, lent sur gros volumes |
| ORM (Prisma, Drizzle) | Typage, migrations | Tooling lourd, génération de code, moteur natif pour Prisma |

## Décision

**`node:sqlite`, sans ORM.** Requêtes SQL explicites dans des dépôts typés
(`src/main/db/repositories/*`), migrations versionnées en TypeScript appliquées via
`PRAGMA user_version` (une transaction par migration, rollback en cas d'échec, refus d'une base
plus récente que l'application), mode WAL, clés étrangères activées.

Schéma initial (`001-initial.ts`) : `sources`, `media_files`, `movies`, `shows`, `episodes`,
`artists`, `albums`, `tracks`, `podcasts`, `podcast_episodes`, `playlists`, `playlist_items`,
`playback_state`, `history`, `settings`, et l'index FTS5 `search_index` (tokenizer `unicode61`,
diacritiques ignorés). Index sur les colonnes de tri et de filtre.

Sauvegarde à chaud par `VACUUM INTO` (copie cohérente et compactée), restauration avec contrôle
d'intégrité et conservation de l'ancienne base en `.before-restore`.

## Conséquences

- La CI et Vitest tournent sur **Node 24** (le renderer n'est pas concerné).
- Le lecteur enregistre chaque fichier ouvert, reprend la lecture, marque « vu » à 90 %, mémorise
  volume et favoris — premier consommateur réel de la base.
- Mesuré (tests) : recherche FTS et pagination triée sur 5 000 fichiers < 100 ms (en pratique
  quelques ms) ; persistance, migration sans perte, sauvegarde/restauration couverts par 24 tests.
- Si `node:sqlite` devait poser problème, `better-sqlite3` expose une API quasi identique
  (`prepare/run/get/all`) : la migration se limiterait aux dépôts.
