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

Décision consignée dans l'[ADR 0001](docs/adr/0001-choix-stack.md), fondée sur un
[benchmark comparatif](docs/benchmark-stack.md) Electron / Tauri / Qt.

- Langage : **C++17**
- Interface : **Qt 6 (≥ 6.5)** — QML / Qt Quick Controls 2, style `Basic` (identique sur les 3 OS)
- Traitement multimédia : **Qt Multimedia** (backend FFmpeg)
- Build : **CMake ≥ 3.25 + Ninja**, presets `debug` / `release` / `ci`
- Tests : **Qt Test + CTest**
- Intégrations externes : APIs REST (TheMovieDB, etc.) via QtNetwork
- Métadonnées : base de données locale (SQLite)

## Démarrer

### Prérequis

- Qt 6.5+ avec les modules Core, Gui, Qml, Quick, QuickControls2, Test
- CMake 3.25+, Ninja, un compilateur C++17 (GCC 12+, Clang 15+, MSVC 2022)
- `clang-format` (formatage, vérifié par le hook de pre-commit et la CI)

### Développement (hot-reload QML)

```bash
git clone git@github.com:Nxva83/simulated.git && cd simulated
./scripts/setup-hooks.sh      # active le hook pre-commit (clang-format)
./scripts/dev.sh              # configure + build Debug + lance l'app
```

En build **Debug**, l'application charge les `.qml` depuis `src/ui/` et **recharge la fenêtre
automatiquement à chaque sauvegarde** (`src/app/QmlHotReloader`). En Release, les QML sont
compilés et embarqués dans le binaire.

### Lecture d'un média

```bash
./build/debug/src/epikodi ~/Vidéos/film.mkv      # ouvre directement le lecteur
```

Dans la section **Lecteur** : `Ctrl+O` ouvre un fichier, `Espace` lecture/pause, `←`/`→` ±10 s,
`↑`/`↓` volume, `M` muet. Le décodage est assuré par **Qt Multimedia (backend FFmpeg)** : H.264,
HEVC, VP9, AV1, AAC, AC3, DTS, MP3, FLAC… avec accélération matérielle automatique (VAAPI /
D3D11 / VideoToolbox — forçable via `QT_FFMPEG_DECODING_HW_DEVICE_TYPES`).

### Build Release et tests

```bash
cmake --preset release && cmake --build --preset release
cmake --preset ci && cmake --build --preset ci && ctest --preset ci   # warnings = erreurs
```

## Arborescence

```
.
├── CMakeLists.txt          Projet racine (options, warnings, Qt)
├── CMakePresets.json       Presets debug / release / ci
├── src/
│   ├── main.cpp            Point d'entrée
│   ├── app/                Infrastructure applicative (QmlHotReloader…)
│   ├── core/               Bibliothèque `epikodi_core` : logique métier sans UI (Version…)
│   ├── media/              Module `Epikodi.Media` : `Player` (Qt Multimedia/FFmpeg), `MediaFormats`
│   └── ui/                 Module QML `Epikodi.Ui` (Main.qml, PlayerView.qml, components/)
├── assets/                 Icônes, polices, images embarquées
├── tests/                  Tests Qt Test (une cible par fichier, `epikodi_add_test`)
│   └── fixtures/           Médias de test générés par ffmpeg (MP4 H.264/AAC, MKV HEVC/AC3, MP3, FLAC…)
├── docs/
│   ├── adr/                Architecture Decision Records
│   └── benchmark-stack.md  Benchmark Electron / Tauri / Qt
├── benchmark/              Sources du benchmark de stack (reproductible)
├── scripts/                dev.sh, setup-hooks.sh
├── .githooks/              pre-commit : clang-format sur les fichiers indexés
└── .github/workflows/      CI : build + tests sur Ubuntu, Windows, macOS + vérification du format
```

## Conventions

- **C++** : style `.clang-format` (base LLVM, 4 espaces, 100 colonnes, `Type* ptr`), namespace
  `epikodi`, un composant = `Nom.h` + `Nom.cpp`. `clang-tidy` configuré (`.clang-tidy`).
- **QML** : un composant par fichier en `PascalCase.qml`, 2 espaces, propriétés `required`
  pour les données de délégué, pas de logique métier dans le QML (elle vit dans `core/`).
- **Dépendances entre couches** : `ui` → `app` → `media` → `core`. `core` et `media` ne dépendent
  jamais de Qt Quick ; l'UI ne parle à Qt Multimedia qu'à travers `Epikodi.Media.Player`.
- **Tests** : tout ce qui est dans `core/` est testable sans UI ; un `test_<sujet>.cpp` par sujet.
- **Commits** : [Conventional Commits](https://www.conventionalcommits.org/fr/) en français
  (`feat:`, `fix:`, `docs:`, `build:`, `ci:`, `test:`), référence à l'issue en fin de sujet.
- **Décisions** : toute décision d'architecture structurante fait l'objet d'un ADR dans `docs/adr/`.

## Statut

- **v0.1 — Fondations** (#1) : stack choisie, squelette Qt/CMake, hot-reload, tests, CI ✔
- **v1 — MVP** : décodage et lecteur (#2) ✔ · indexation (#4), base de métadonnées (#9),
  bibliothèque (#13) à venir.

## Licence

Distribue sous licence MIT. Voir le fichier LICENSE pour plus de details.
