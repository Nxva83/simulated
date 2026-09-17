# Benchmark de stack EPIKODI

Trois implémentations de la **même** mini-application (fenêtre + liste des fichiers de `$HOME`
via le pont natif + signal `READY` à la première frame), pour départager Electron, Tauri et Qt.
Rapport et décision : [`docs/benchmark-stack.md`](../docs/benchmark-stack.md).

```
common/    index.html partagé par Electron et Tauri
electron/  main.js (IPC), preload.js (contextBridge), package.json
tauri/     src/main.rs (#[tauri::command]), tauri.conf.json, capabilities/
qt/        main.cpp, bridge.h (Q_INVOKABLE), Main.qml, CMakeLists.txt
run.py     mesure startup / mémoire PSS / nb de processus, écrit results/runtime.csv
results/   runtime.csv (commité) + logs de build (ignorés par git)
```

## Prérequis (Linux)

Node ≥ 20, Rust stable, `webkit2gtk-4.1`, Qt 6 (Core, Gui, Qml, Quick, QuickControls2), CMake ≥ 3.21, Ninja.

## Lancer

```bash
(cd electron && npm install && npm run package)      # → electron/out/…/epikodi-bench-electron
(cd tauri && cargo build --release)                  # → tauri/target/release/epikodi-bench-tauri
cmake -S qt -B qt/build -G Ninja -DCMAKE_BUILD_TYPE=Release && cmake --build qt/build
RUNS=5 python3 run.py electron tauri qt
```

Pour chronométrer les builds à froid : `date +%s.%N` avant/après (`/usr/bin/time` n'est pas
installé partout), après `rm -rf ~/.cache/electron`, `cargo clean` et `rm -rf qt/build`.

## Ce que mesure `run.py`

- **startup_ms** : `READY <epoch_ms>` émis par l'app − instant du `spawn`. Le `READY` est envoyé
  après un double `requestAnimationFrame` (web) ou sur `QQuickWindow::frameSwapped` (Qt), donc
  après la première frame effectivement peinte.
- **pss_mb** : somme du PSS (`/proc/<pid>/smaps_rollup`) de tout l'arbre de processus 4 s après
  READY. Le PSS répartit les pages partagées entre processus, contrairement au RSS.
- **procs** : taille de l'arbre de processus.
