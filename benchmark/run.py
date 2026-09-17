#!/usr/bin/env python3
"""Benchmark runtime des trois prototypes EPIKODI (Electron / Tauri / Qt).

Pour chaque app : N lancements. A chaque lancement on mesure
  - startup_ms : delai entre le spawn et la ligne "READY <epoch_ms>" emise par l'app
                 au premier rendu effectif de la fenetre ;
  - pss_mb     : memoire PSS (Proportional Set Size, evite de compter 2x les libs
                 partagees) sommee sur l'arbre complet de processus, 4 s apres READY ;
  - procs      : nombre de processus dans l'arbre.
Ecrit results/runtime.csv et affiche les medianes.
"""
import csv, os, signal, statistics, subprocess, sys, time
from pathlib import Path

HERE = Path(__file__).resolve().parent
RUNS = int(os.environ.get("RUNS", "5"))
SETTLE_S = 4.0

APPS = {
    "electron": [str(HERE / "electron/out/epikodi-bench-electron-linux-x64/epikodi-bench-electron")],
    "tauri":    [str(HERE / "tauri/target/release/epikodi-bench-tauri")],
    "qt":       [str(HERE / "qt/build/epikodi-bench-qt")],
}

def descendants(pid):
    out, stack = [], [pid]
    while stack:
        p = stack.pop()
        out.append(p)
        try:
            kids = subprocess.run(["pgrep", "-P", str(p)], capture_output=True, text=True).stdout.split()
        except FileNotFoundError:
            kids = []
        stack.extend(int(k) for k in kids)
    return out

def pss_kb(pid):
    try:
        with open(f"/proc/{pid}/smaps_rollup") as f:
            for line in f:
                if line.startswith("Pss:"):
                    return int(line.split()[1])
    except (FileNotFoundError, PermissionError, ProcessLookupError):
        pass
    return 0

def one_run(cmd):
    t0 = time.time() * 1000
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                            text=True, start_new_session=True)
    ready_ms = None
    deadline = time.time() + 30
    while time.time() < deadline:
        line = proc.stdout.readline()
        if not line:
            break
        if line.startswith("READY "):
            ready_ms = int(line.split()[1])
            break
    if ready_ms is None:
        os.killpg(proc.pid, signal.SIGKILL)
        raise RuntimeError(f"{cmd[0]}: pas de READY en 30 s")
    time.sleep(SETTLE_S)
    tree = descendants(proc.pid)
    pss = sum(pss_kb(p) for p in tree)
    os.killpg(proc.pid, signal.SIGTERM)
    try:
        proc.wait(5)
    except subprocess.TimeoutExpired:
        os.killpg(proc.pid, signal.SIGKILL)
    time.sleep(0.5)
    return ready_ms - t0, pss / 1024, len(tree)

def main():
    names = sys.argv[1:] or list(APPS)
    rows = []
    for name in names:
        cmd = APPS[name]
        if not Path(cmd[0]).exists():
            print(f"[{name}] binaire absent : {cmd[0]}", file=sys.stderr)
            continue
        one_run(cmd)  # warm-up : cache disque
        for i in range(RUNS):
            st, mem, n = one_run(cmd)
            rows.append({"app": name, "run": i + 1, "startup_ms": round(st), "pss_mb": round(mem, 1), "procs": n})
            print(f"[{name}] run {i+1}: startup {st:.0f} ms, PSS {mem:.1f} MB, {n} procs")
    out = HERE / "results/runtime.csv"
    out.parent.mkdir(exist_ok=True)
    with open(out, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["app", "run", "startup_ms", "pss_mb", "procs"])
        w.writeheader(); w.writerows(rows)
    print("\n== medianes ==")
    for name in names:
        r = [x for x in rows if x["app"] == name]
        if r:
            print(f"{name:9s} startup {statistics.median(x['startup_ms'] for x in r):6.0f} ms | "
                  f"PSS {statistics.median(x['pss_mb'] for x in r):6.1f} MB | procs {r[0]['procs']}")

if __name__ == "__main__":
    main()
