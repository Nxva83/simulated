# Benchmark de stack — Electron vs Tauri vs Qt

> Issue GitHub : #1 « Mettre en place l'architecture du projet (Electron/Qt/Tauri) »
> Date : 17 septembre 2026 · Auteur : Nxva83
> Sources et scripts reproductibles : [`benchmark/`](../benchmark/)

## 1. Question posée

EPIKODI est un centre multimédia desktop (lecture vidéo/audio tous formats, stockage local
et réseau, extensions, thèmes, émulateurs, télécommandes). Le choix du framework d'interface
conditionne tout le reste du projet. Plutôt que de comparer sur des fiches marketing, **la même
mini-application a été développée trois fois** et mesurée sur la même machine :

- une fenêtre 1024×640 au thème sombre,
- un titre + le nom de la stack,
- la liste des fichiers de `$HOME` obtenue **via le pont natif** (IPC main/renderer pour
  Electron, `#[tauri::command]` pour Tauri, `Q_INVOKABLE` C++ → QML pour Qt),
- un signal `READY <timestamp>` émis sur stdout **à la première frame réellement affichée**
  (double `requestAnimationFrame` côté web, `QQuickWindow::frameSwapped` côté Qt).

Electron et Tauri partagent exactement le même `index.html` (48 lignes) ; Qt utilise un
équivalent QML.

## 2. Environnement de test

| | |
|---|---|
| Machine | AMD Ryzen 7 5800H (16 threads), 14 Go RAM, NVMe |
| OS | Arch Linux (CachyOS), noyau 6.18, Wayland (Hyprland) |
| Electron | 44.4.1 (Chromium embarqué) — Node 26.8.1, npm 12.0.2 |
| Tauri | 2.11.5 (wry 0.55.1) sur WebKitGTK 2.52.6 — Rust 1.98.1 |
| Qt | 6.11.2 (Qt Quick / Qt Quick Controls 2) — GCC 16.2.1, CMake 4.4.3, Ninja |

Caches vidés avant mesure (`~/.cache/electron`, registry Cargo vide, `cargo clean`,
`rm -rf build`). Mesures runtime : 1 lancement de chauffe + 5 lancements, **médiane** retenue.

## 3. Résultats bruts

### 3.1 Mise en place et compilation (à froid)

| Mesure | Electron | Tauri | Qt |
|---|---:|---:|---:|
| Setup / build à froid | **22 s** (7 s npm + 15 s téléchargement Chromium) | **136 s** (270 crates compilés, profil release LTO) — 70 s en profil dev | **4 s** (cmake + ninja) |
| Rebuild incrémental après modif. du code natif | **0 s** (aucune compilation, relance) | 1,4 s (dev) / 66 s (release LTO) | 2,3 s |
| Hot-reload de l'UI | natif (Chromium DevTools, F5) | via Vite sur le front web | outils tiers (Qt Design Studio, `qmllive`) |
| Dépendances tirées | 47 paquets npm | 430 crates | libs système Qt6 |
| Espace disque de dev | 314 Mo (`node_modules`) | 1 015 Mo (`target/`) | ~1 Mo (`build/`) |
| Lignes de code du pont natif | 28 (JS) | 62 (Rust + conf) | 102 (C++ + QML, UI incluse) |

### 3.2 Taille distribuée

| Mesure | Electron | Tauri | Qt |
|---|---:|---:|---:|
| Binaire / paquet produit | **283 Mo** (`electron-packager`, app = 28 Ko en asar) | **4,3 Mo** (binaire strippé, LTO) | **91 Ko** |
| Runtime nécessaire en plus | aucun (tout embarqué) | WebView du système : WebKitGTK (126 Mo, présent sur les bureaux GNOME/GTK), WebView2 (Windows 10/11), WKWebView (macOS) | libs Qt6 liées : 38 Mo + plugins QML/platform 13 Mo ≈ **51 Mo** à embarquer (`windeployqt`/`macdeployqt`/AppImage). Qt Multimedia + FFmpeg non comptés (~+25 Mo). |
| Ordre de grandeur installé | ~285 Mo | ~5 Mo (+ WebView système) | ~50–80 Mo |

### 3.3 Runtime (médiane sur 5 lancements)

| Mesure | Electron | Tauri | Qt |
|---|---:|---:|---:|
| Démarrage → première frame | 375 ms | 360 ms | **125 ms** |
| Mémoire PSS (arbre complet de processus, +4 s) | 260 Mo | 261 Mo | **87 Mo** |
| Processus | 7 (main, zygote, GPU, renderer, utility…) | 6 (app 94 Mo + WebKitWebProcess 140 Mo + NetworkProcess 30 Mo + bwrap ×2 + glycin) | **1** |

Écart-type très faible (startup ± 6 ms, PSS ± 3 Mo). Un run Tauri a rapporté 0 Mo / 1 processus
(les sous-processus WebKit, lancés via `bwrap`, n'ont pas été rattachés à temps) : artefact de
mesure, sans effet sur la médiane. Détail par run : [`benchmark/results/runtime.csv`](../benchmark/results/runtime.csv).

**Enseignement contre-intuitif :** sur Linux, Tauri ne fait *pas* mieux qu'Electron en mémoire
ni en démarrage. Son avantage est le poids sur disque (×65), pas la RAM : un moteur web complet
(WebKit) tourne quand même, simplement il n'est pas embarqué. Sur Windows (WebView2, partagé) et
macOS (WKWebView) l'écart RAM serait plus favorable à Tauri, mais reste du même ordre.

## 4. Analyse par critère pour EPIKODI

Les poids reflètent les défis techniques listés dans le README du projet. Notes sur 5.

| Critère | Poids | Electron | Tauri | Qt | Justification |
|---|---:|:-:|:-:|:-:|---|
| **Lecture multimédia / codecs (FFmpeg)** | 25 % | 2 | 2 | **5** | Les WebView (Chromium comme WebKit/WebView2) ne décodent pas HEVC, AC3, DTS, TrueHD… Il faudrait un lecteur natif (libmpv) et un pont fragile vers la fenêtre web. **Qt Multimedia utilise FFmpeg comme backend par défaut depuis Qt 6.5** ; `VideoOutput` QML rend sur GPU, pas de pont. Kodi lui-même est en C++. |
| **Performance runtime** | 15 % | 2 | 3 | **5** | Mesuré : Qt 3× plus rapide au démarrage, 3× moins de RAM, 1 processus. Important sur un HTPC / mini-PC de salon. |
| **Taille distribuée** | 10 % | 1 | **5** | 3 | 283 Mo vs 4 Mo vs ~50–80 Mo. |
| **Accès système** (FS, SMB/NFS/DLNA, télécommandes, émulateurs) | 15 % | 4 | 4 | **5** | Node et Rust couvrent bien FS/réseau. Qt/C++ accède directement aux libs natives (libsmbclient, libretro, D-Bus via QtDBus) sans binding intermédiaire. |
| **UI dynamique, thèmes, plugins** | 15 % | **5** | 4 | 4 | Le web est imbattable pour les thèmes (CSS) et l'écosystème. Tauri perd un point : trois moteurs de rendu différents selon l'OS → incohérences visuelles. QML est déclaratif et très dynamique (styles Qt Quick Controls, chargement de `.qml` à chaud, plugins `QQmlExtensionPlugin`, scripting JS intégré via `QJSEngine`). |
| **Productivité / DX** | 10 % | **5** | 3 | 3 | Electron : zéro compilation, DevTools. Tauri : 70–136 s à froid mais 1,4 s ensuite + Vite. Qt : 4 s / 2,3 s, mais pas de hot-reload natif et outillage moins « moderne ». |
| **Multi-OS et packaging** | 5 % | **5** | 4 | 4 | Electron le plus uniforme. Tauri dépend du WebView de l'OS. Qt : SDK par OS, licence LGPLv3 (compatible MIT en liaison dynamique). |
| **Compétences équipe / courbe d'apprentissage** | 5 % | 4 | 2 | 4 | C/C++ est le socle du cursus EPITECH ; QML s'apprend vite. Rust est la courbe la plus raide. JS connu de tous. |
| **Score pondéré** | | **3,20** | **3,25** | **4,35** | |

## 5. Décision : **Qt 6 (C++ + QML)**

### Pourquoi

1. **Le cœur du projet, c'est la lecture vidéo tous formats.** C'est le critère le plus lourd et
   c'est là que les deux stacks web sont structurellement faibles : un WebView ne décodera jamais
   la majorité des fichiers d'une médiathèque réelle (MKV HEVC + AC3/DTS). Contourner avec libmpv
   revient à réécrire à la main ce que Qt Multimedia + FFmpeg fournit déjà.
2. **Les mesures runtime sont sans appel** : 125 ms et 87 Mo contre ~370 ms et ~260 Mo, avec un
   seul processus. Un media center tourne souvent sur du matériel modeste branché à une TV.
3. **Le précédent Kodi** : l'application dont EPIKODI s'inspire est en C++ pour exactement ces
   raisons (décodage, accélération matérielle, émulateurs via libretro, télécommandes).
4. **Compétences EPITECH** : le C++ est déjà maîtrisé ; seul QML est à apprendre.

### Ce qu'on perd et comment on le compense

| Risque | Mitigation |
|---|---|
| Pas de hot-reload « web » | QML se recharge à chaud avec `QQmlApplicationEngine::clearComponentCache()` + rechargement en dev ; Qt Design Studio pour le prototypage. |
| Écosystème de thèmes/plugins moins grand-public que le web | Thèmes = styles Qt Quick Controls + fichiers `.qml` chargés dynamiquement ; plugins = `QQmlExtensionPlugin` (C++) ou scripts JS via `QJSEngine`. Documenter une API de plugin stable dès la v2. |
| ~50–80 Mo à distribuer | Acceptable pour un media center (Kodi ≈ 100 Mo). `windeployqt`, `macdeployqt`, AppImage/Flatpak sur Linux. |
| Licence Qt LGPLv3 | Liaison dynamique aux libs Qt → compatible avec la licence MIT du projet. Ne pas modifier Qt lui-même. |
| Rendu vidéo à valider | **Spike de validation dans l'issue #2** : lire un MKV HEVC/AC3 avec `MediaPlayer` + `VideoOutput` avant d'aller plus loin. |

### Et si l'équipe préfère une stack web ?

Second choix : **Tauri**, uniquement si l'équipe accepte un lecteur hybride (libmpv rendu dans une
surface native) et les différences de rendu entre OS. Electron n'est pas retenu : aucun avantage
technique sur Tauri hormis la DX, pour 65× plus de poids et la même mémoire.

## 6. Reproduire le benchmark

```bash
cd benchmark
# Electron
(cd electron && npm install && npm run package)
# Tauri
(cd tauri && cargo build --release)
# Qt
cmake -S qt -B qt/build -G Ninja -DCMAKE_BUILD_TYPE=Release && cmake --build qt/build
# Runtime (1 warm-up + 5 runs par stack, medianes en sortie, CSV dans results/)
RUNS=5 python3 run.py electron tauri qt
```

Le protocole complet et les logs bruts (`results/*.log`) sont décrits dans
[`benchmark/README.md`](../benchmark/README.md).

## 7. Suite

- [ ] Rédiger l'ADR `docs/adr/0001-choix-stack.md` à partir de ce document (issue #1)
- [ ] Spike lecture vidéo Qt Multimedia + FFmpeg sur un MKV HEVC/AC3 (issue #2)
- [ ] Initialiser le squelette Qt/CMake du projet (issue #1)
