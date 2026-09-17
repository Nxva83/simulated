# ADR 0001 — Choix de la stack applicative : Qt 6 (C++ / QML)

| | |
|---|---|
| **Statut** | **Remplacé** par [ADR 0002](0002-passage-a-electron.md) le 2026-09-17 |
| **Date** | 2026-09-17 |
| **Décideurs** | Nxva83 |
| **Issue** | #1 — Mettre en place l'architecture du projet |
| **Données** | [`docs/benchmark-stack.md`](../benchmark-stack.md) — benchmark reproductible dans [`benchmark/`](../../benchmark/) |

## Contexte

EPIKODI est un centre multimédia desktop inspiré de Kodi : lecture de vidéos, musiques et podcasts
dans « la plupart des formats », depuis le stockage local, le réseau (SMB/NFS/DLNA) et Internet,
avec extensions, thèmes, émulateurs de jeux et télécommandes. Il doit tourner sur Windows, Linux
et macOS, souvent sur du matériel modeste branché à une TV.

Le README envisageait trois frameworks d'interface : **Electron**, **Tauri** et **Qt**. Ce choix
conditionne le langage du backend, la stratégie de lecture vidéo, le système de plugins et le
packaging. Il fallait le trancher avant toute autre issue.

## Options étudiées

La même mini-application (fenêtre, listing de `$HOME` via le pont natif, signal à la première
frame) a été implémentée et mesurée avec chaque option, à froid, sur la même machine
(Ryzen 7 5800H, Arch Linux, Wayland).

| Option | Build à froid | Taille distribuée | Démarrage | RAM (PSS) | Processus |
|---|---:|---:|---:|---:|---:|
| Electron 44 (Chromium + Node) | 22 s | 283 Mo | 375 ms | 260 Mo | 7 |
| Tauri 2.11 (Rust + WebView système) | 136 s | 4,3 Mo + WebView OS | 360 ms | 261 Mo | 6 |
| **Qt 6.11 (C++ + QML)** | **4 s** | 91 Ko + ~51 Mo libs Qt | **125 ms** | **87 Mo** | **1** |

Grille pondérée sur huit critères tirés des défis techniques du projet (codecs 25 %, perf 15 %,
accès système 15 %, UI/thèmes 15 %, taille 10 %, DX 10 %, multi-OS 5 %, compétences 5 %) :
**Qt 4,35 / 5**, Tauri 3,25, Electron 3,20.

## Décision

EPIKODI est développé en **C++17 avec Qt 6 (≥ 6.5)** : interface en **QML / Qt Quick Controls 2**,
lecture multimédia via **Qt Multimedia (backend FFmpeg)**, build **CMake + Ninja**.

## Justification

1. **Lecture tous formats — le cœur du produit.** Aucun WebView (Chromium d'Electron, WebKitGTK /
   WebView2 / WKWebView de Tauri) ne décode HEVC, AC3, DTS ou TrueHD, omniprésents dans une
   médiathèque réelle. Les stacks web imposeraient un lecteur natif (libmpv) greffé à la fenêtre
   web par un pont fragile. Qt Multimedia utilise FFmpeg comme backend par défaut depuis Qt 6.5 et
   `VideoOutput` rend sur GPU directement dans la scène QML.
2. **Performances mesurées** : 3× plus rapide au démarrage, 3× moins de mémoire, un seul processus.
   Déterminant pour un HTPC.
3. **Accès système direct** : libsmbclient, libretro (émulateurs), D-Bus (QtDBus), sockets HTTP/JSON-RPC
   (QtNetwork) se consomment en C++ sans couche de binding.
4. **Précédent** : Kodi est en C++ pour exactement ces raisons.
5. **Compétences** : le C/C++ est le socle du cursus EPITECH ; seul QML est à apprendre.
6. **Tauri n'apporte pas ce qu'on attendait** : sur Linux il consomme autant de RAM qu'Electron
   (WebKitWebProcess 140 Mo + NetworkProcess 30 Mo). Son seul gain net est le poids sur disque.
   Electron cumule le pire poids (283 Mo) sans avantage technique sur Tauri hormis la DX.

## Conséquences

### Positives
- Une seule base de code C++ pour le backend, le lecteur, le réseau et les intégrations natives.
- Thèmes = styles Qt Quick Controls + fichiers `.qml` chargés dynamiquement ; plugins =
  `QQmlExtensionPlugin` (C++) ou scripts JavaScript via `QJSEngine`.
- Packaging standard par OS : `windeployqt`, `macdeployqt`, AppImage/Flatpak.

### Négatives et mitigations
| Conséquence | Mitigation |
|---|---|
| Pas de hot-reload « web » de l'UI | Rechargement QML en dev (`QQmlApplicationEngine::clearComponentCache()` + `load`) ; Qt Design Studio pour le prototypage. |
| Courbe d'apprentissage QML | Module de formation interne ; Qt Quick Controls 2 fournit les composants de base. |
| ~50–80 Mo à distribuer (libs Qt + Qt Multimedia/FFmpeg) | Acceptable pour un media center (Kodi ≈ 100 Mo). |
| Licence Qt LGPLv3 | Liaison dynamique aux libs Qt, sans modification de Qt → compatible avec la licence MIT du projet. |
| Rendu vidéo à valider | **Spike obligatoire dans l'issue #2** : lire un MKV HEVC/AC3 avec `MediaPlayer` + `VideoOutput` avant d'aller plus loin. Si échec, repli sur libmpv intégré via `QQuickFramebufferObject`. |

### Neutres
- Le SDK Qt doit être installé par OS pour les développeurs et la CI (action `install-qt-action`).
- Pas de `node_modules` ni de `target/` : l'outillage JS/Rust n'est pas requis.

## Alternatives écartées

- **Tauri** — second choix. Retenu uniquement si l'équipe exigeait une UI web, au prix d'un lecteur
  hybride libmpv et de rendus différents selon l'OS.
- **Electron** — écarté : 65× plus lourd que Tauri pour la même mémoire et les mêmes limites de codecs.

## Révision

**2026-09-17 — Spike vidéo validé (issue #2).** Un MKV HEVC + AC3 (`tests/fixtures/pattern-hevc-ac3.mkv`)
est décodé et rendu par Qt Multimedia 6.11 / FFmpeg 9 dans `VideoOutput` ; le test
`TestPlayer::loadsMkvHevcAc3` le vérifie en CI. La condition de repli sur libmpv n'est pas
déclenchée : la décision est confirmée.

Cet ADR sera réévalué si la composition de l'équipe change radicalement (majorité de profils web
sans C++).
