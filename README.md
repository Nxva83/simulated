# EPIKODI

> Centre multimedia desktop pour lire et organiser videos, musique, podcasts et medias numeriques.
> Projet professionnel simule EPITECH.

## A propos

EPIKODI est une application de centre multimedia libre inspiree de Kodi. Elle permet de lire et consulter la plupart des videos, musiques, podcasts et autres fichiers medias numeriques a partir du stockage local, du reseau et d'Internet.

L'application se veut entierement personnalisable : extensions, themes, connecteurs a des bases de donnees externes (TheMovieDB, etc.), emulateurs de jeux et telecommandes.

## Fonctionnalites cles

- Lecture de videos, musiques et medias numeriques
- Acces au stockage local et reseau
- Systeme d'extensions et de themes personnalisables
- Integration avec des bases de donnees externes (metadonnees)
- Support des emulateurs de jeux et des telecommandes

## Defis techniques

- Gestion de plusieurs formats de medias et codecs
- Acces et parcours efficace du stockage reseau
- Architecture extensible via un systeme de plugins
- Interface utilisateur dynamique et personnalisable

## Stack technologique

Décision consignée dans l'[ADR 0002](docs/adr/0002-passage-a-electron.md) (qui remplace
l'[ADR 0001](docs/adr/0001-choix-stack.md) fondé sur un [benchmark Electron / Tauri / Qt](docs/benchmark-stack.md)).

- **Electron 44** (Chromium + Node) · **Vite** via electron-vite · **TypeScript** · **React 19**
- Lecture multimédia : élément `<video>` de Chromium, fichiers servis par un protocole `media://`
  avec support des requêtes Range (seek) ; pistes audio AC3/E-AC3/DTS converties à la volée par
  `ffmpeg-static`
- Outillage : ESLint, Prettier, Husky + lint-staged, Vitest, electron-builder
- Intégrations externes : APIs REST (TheMovieDB, etc.)
- Bibliothèque et état de lecture : **SQLite** via `node:sqlite` (intégré à Node 24 / Electron 44,
  aucun module natif à recompiler), migrations versionnées, recherche plein texte FTS5

## Démarrer

### Prérequis

Node.js 22+ et npm. Rien d'autre : Electron est téléchargé par npm.

### Développement

```bash
git clone git@github.com:Nxva83/simulated.git && cd simulated
npm install          # dépendances + hook pre-commit (Husky)
npm run dev          # lance l'app avec hot-reload (renderer) et redémarrage auto (main)
```

### Lecture d'un média

```bash
npm run build && npx electron . ~/Vidéos/film.mkv   # ouvre directement le lecteur
```

Dans la section **Lecteur** : `Ctrl+O` ouvrir un fichier, `Espace` lecture/pause, `←`/`→` ±10 s,
`↑`/`↓` volume, `M` muet, `F` favori, clic sur la vidéo = pause, double-clic = ouvrir.

Chaque fichier ouvert est enregistré dans la bibliothèque (`<userData>/epikodi.db`) : la lecture
**reprend où elle s'était arrêtée**, un média lu à plus de 90 % est marqué **vu**, le volume et les
favoris sont mémorisés.

### Bibliothèque

**Réglages → Ajouter un dossier…** : le dossier est parcouru en tâche de fond (extension **et**
type MIME pour les fichiers sans extension, dossiers cachés/système ignorés), chaque média est
inspecté (durée, résolution, codecs, tags ID3 → artistes / albums / pistes), une vignette est
générée pour les vidéos, puis le dossier est **surveillé** : un fichier ajouté, modifié ou supprimé
met la bibliothèque à jour tout seul. Les scans suivants sont incrémentaux (taille + date). Les
sections **Films** et **Musique** affichent le résultat ; un clic lance la lecture.

Chromium décode nativement H.264, VP9, AV1, AAC, MP3, FLAC, Opus — mais **pas** AC3/E-AC3/DTS,
ni MPEG-2, DivX/Xvid, VC-1, ni HEVC sans décodeur matériel. Le lecteur inspecte le fichier avant
lecture (`src/main/mediaInspect.ts`) et, seulement si nécessaire, **convertit à la volée** avec le
ffmpeg embarqué (`ffmpeg-static`, `src/main/transcoder.ts`) : audio → AAC, vidéo copiée ou
réencodée en H.264. Dans ce mode le seek relance le flux à la position voulue (~1 s) et un bandeau
l'indique. Résultat : MKV, MP4, AVI, WMV, TS, MP3, FLAC… se lisent, avec le son.

### Qualité, tests, packaging

```bash
npm run lint && npm run typecheck && npm test     # ce que fait la CI
npm run smoke                                      # ouvre la fenêtre, vérifie le rendu, quitte
npm run smoke:media                                # idem + lit le MKV HEVC/AC3 et rapporte les octets décodés
npm run package                                    # dist/<os>-unpacked (sans installateur)
npm run dist                                       # AppImage/deb, NSIS, dmg
```

## Arborescence

```
.
├── package.json              Scripts npm, dépendances
├── electron.vite.config.ts   Build main / preload / renderer (alias @shared, @renderer)
├── electron-builder.yml      Packaging (AppImage, deb, NSIS, dmg)
├── src/
│   ├── main/                 Processus principal : fenêtre, protocole media:// (fichiers avec Range,
│   │                         flux ffmpeg transcodé), IPC, inspection des codecs
│   ├── main/db/              SQLite : migrations versionnées, dépôts (fichiers, musique, lecture,
│   │                         réglages, sources), recherche FTS5, sauvegarde / restauration
│   ├── main/scanner/         Indexation : parcours (walk), scan incrémental, vignettes ffmpeg,
│   │                         watcher chokidar, orchestration (ScanManager)
│   ├── preload/              Pont sécurisé (contextBridge) → window.epikodi
│   ├── shared/               Code partagé main/renderer : formats, erreurs, codecs, contrat IPC
│   └── renderer/src/         UI React : App, Sidebar, PlayerView (hook usePlayer), LibraryView, SettingsView
├── tests/
│   ├── unit/                 Tests Vitest
│   └── fixtures/             Médias de test générés par ffmpeg (MP4 H.264/AAC, MKV HEVC/AC3, MP3, FLAC…)
├── assets/                   Icônes et ressources de packaging
├── docs/adr/                 Architecture Decision Records
├── docs/benchmark-stack.md   Benchmark Electron / Tauri / Qt
├── benchmark/                Sources du benchmark (reproductible)
└── .github/workflows/        CI : lint, typecheck, tests, build + smoke + packaging sur 3 OS
```

## Conventions

- **TypeScript strict** partout ; formatage Prettier et règles ESLint appliqués par le hook de
  pre-commit (lint-staged) et vérifiés en CI.
- **Sécurité Electron** : `contextIsolation` activé, aucun accès Node dans le renderer ; tout passe
  par `window.epikodi` (preload) et le contrat `src/shared/ipc.ts`.
- **Couches** : `renderer` → `preload` → `main`. La logique de lecture vit dans le hook
  `usePlayer` ; les composants n'affichent que l'état.
- **Tests** : la logique partagée (`src/shared`) et les fonctions pures de `main` sont testées
  avec Vitest ; le smoke test CI prouve que l'app se lance sur chaque OS.
- **Commits** : [Conventional Commits](https://www.conventionalcommits.org/fr/) en français
  (`feat:`, `fix:`, `docs:`, `build:`, `ci:`, `test:`), référence à l'issue en fin de sujet.
- **Décisions** : toute décision d'architecture structurante fait l'objet d'un ADR dans `docs/adr/`.

## Statut

- **v0.1 — Fondations** (#1) : stack choisie, squelette Electron, hot-reload, lint, tests, CI ✔
- **v1 — MVP** : lecteur (#2) ✔ · indexation (#4), base de métadonnées (#9), bibliothèque (#13) à venir.

## Licence

Distribue sous licence MIT. Voir le fichier LICENSE pour plus de details.
