# ADR 0002 — Passage à Electron (remplace l'ADR 0001)

| | |
|---|---|
| **Statut** | Accepté |
| **Date** | 2026-09-17 |
| **Décideurs** | Nxva83 |
| **Remplace** | [ADR 0001 — Qt 6 (C++ / QML)](0001-choix-stack.md) |
| **Issues** | #1, #2 |

## Contexte

L'ADR 0001 retenait Qt 6 après un [benchmark mesuré](../benchmark-stack.md) : meilleures
performances, décodage de tous les formats via FFmpeg. Le squelette Qt, le lecteur et les tests
ont été livrés et validés en CI sur les trois OS (commits `da9e3ce` → `bfcc350`).

À l'usage, le coût d'entrée de Qt (CMake, C++, QML, pas de `npm run dev`) s'est révélé trop
élevé pour le temps que l'équipe peut consacrer au projet. **Le critère « temps de
développement » a été réévalué comme prioritaire** sur les performances et la couverture de
codecs.

## Décision

EPIKODI est développé avec **Electron 44 + Vite (electron-vite) + TypeScript + React 19**.
Lecture multimédia via l'élément `<video>` de Chromium. Outillage : ESLint, Prettier, Husky +
lint-staged, Vitest, electron-builder.

## Ce que ça change concrètement (mesuré sur Electron 44, Linux)

### Codecs décodés par Chromium

| Vidéo | Audio |
|---|---|
| H.264 ✔ · **HEVC ✔** · VP9 ✔ · AV1 ✔ | AAC ✔ · MP3 ✔ · FLAC ✔ · Opus/Vorbis ✔ |
| | **AC3 ✗ · E-AC3 ✗ · DTS ✗ · TrueHD ✗** |

Bonne surprise : HEVC est décodé (le benchmark supposait le contraire). Mauvaise : un MKV avec
piste AC3/DTS — très courant — se lit **en silence, sans aucune erreur** (0 octet audio décodé).

### Mitigations mises en place
- `src/main/mediaInspect.ts` lit les en-têtes du conteneur (`music-metadata`) avant lecture et
  le lecteur affiche un bandeau : « Piste audio AC3 : Chromium ne la décode pas, la vidéo sera
  lue sans son ».
- **Transcodage audio à la volée** (issue #15, livré) : `src/main/transcoder.ts` lance le ffmpeg
  embarqué (`ffmpeg-static`) avec `-c:v copy -c:a aac -f matroska -live 1` et sert le flux via
  `media://transcode/…?t=<s>` ; le seek relance ffmpeg à la position demandée (`-ss` avant `-i`).
  Vérifié en CI sur les 3 OS : le MKV HEVC/AC3 produit des octets audio décodés.
- Le service des fichiers locaux gère lui-même les requêtes Range (`src/main/fileStream.ts`) :
  `net.fetch(file://)` ne les honore pas et rendait les médias non seekables.

### Performances (rappel du benchmark, même machine)

| | Electron | Qt |
|---|---:|---:|
| Démarrage → 1ʳᵉ frame | 375 ms | 125 ms |
| RAM (fenêtre vide) | 260 Mo | 87 Mo |
| Taille distribuée | 283 Mo (mesuré : 292 Mo packagé) | ~50–80 Mo |

Jugé acceptable pour un projet dont l'objectif est d'abord fonctionnel.

## Conséquences

### Positives
- `npm run dev` avec hot-reload instantané, DevTools Chromium, écosystème npm.
- UI en React/CSS : thèmes et extensions triviaux à mettre en œuvre (v2).
- Une seule base TypeScript pour main, preload et renderer ; CI simple (`setup-node`).
- Packaging par `electron-builder` (AppImage/deb, NSIS, dmg) déjà configuré.

### Négatives
- Codecs audio AC3/DTS non décodés (voir mitigations) ; pas de contrôle fin du pipeline vidéo.
- 3× plus de RAM et de temps de démarrage qu'en Qt ; 292 Mo à distribuer.
- Accès système (SMB/NFS, émulateurs, télécommandes) via des modules natifs npm à évaluer
  au cas par cas.

## Alternatives écartées
- **Rester sur Qt** — meilleure techniquement, mais coût d'entrée jugé incompatible avec le temps disponible.
- **Tauri** — même moteur web côté codecs, courbe Rust plus raide, aucun gain de temps.

## Révision
À réévaluer si le transcodage audio s'avère insuffisant (fichiers 4K HEVC 10 bits sans
accélération matérielle, pistes DTS-HD) ou si l'équipe gagne des profils C++.
