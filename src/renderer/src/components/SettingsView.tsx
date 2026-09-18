import { useEffect, useState } from 'react';
import type { ScanProgress, Source, SourceKind } from '@shared/library';

const KINDS: { value: SourceKind; label: string }[] = [
  { value: 'movies', label: 'Films' },
  { value: 'shows', label: 'Séries' },
  { value: 'music', label: 'Musique' },
  { value: 'mixed', label: 'Mixte' },
];

interface Props {
  tvMode: boolean;
  onToggleTv: () => void;
}

/** Réglages : dossiers sources et indexation, affichage, sauvegarde / restauration. */
export default function SettingsView({ tvMode, onToggleTv }: Props) {
  const [sources, setSources] = useState<Source[]>([]);
  const [progress, setProgress] = useState<Record<number, ScanProgress>>({});
  const [kind, setKind] = useState<SourceKind>('movies');
  const [message, setMessage] = useState<string | null>(null);

  const reload = () => void window.epikodi.sources.list().then(setSources);

  useEffect(() => {
    reload();
    void window.epikodi.scan.status().then((list) => {
      setProgress(Object.fromEntries(list.map((p) => [p.sourceId, p])));
    });
    const off = window.epikodi.scan.onProgress((p) =>
      setProgress((prev) => ({ ...prev, [p.sourceId]: p })),
    );
    const offLib = window.epikodi.onLibraryChanged(reload);
    return () => {
      off();
      offLib();
    };
  }, []);

  const addSource = async () => {
    const path = await window.epikodi.sources.pickFolder();
    if (!path) return;
    await window.epikodi.sources.add(path, kind);
    reload();
  };

  const removeSource = async (s: Source) => {
    await window.epikodi.sources.remove(s.id);
    setProgress((prev) => {
      const next = { ...prev };
      delete next[s.id];
      return next;
    });
    reload();
  };

  const backup = async () => {
    const p = await window.epikodi.db.backup();
    setMessage(p ? `Sauvegarde écrite : ${p}` : null);
  };
  const restore = async () => {
    const ok = await window.epikodi.db.restore();
    setMessage(ok ? 'Bibliothèque restaurée.' : null);
    if (ok) reload();
  };

  return (
    <div className="settings">
      <h1>Réglages</h1>

      <section>
        <h2>Dossiers de la bibliothèque</h2>
        <p className="hint">
          Les dossiers sont parcourus en tâche de fond puis surveillés : un fichier ajouté ou
          supprimé met la bibliothèque à jour automatiquement.
        </p>
        <div className="row">
          <select value={kind} onChange={(e) => setKind(e.target.value as SourceKind)}>
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
          <button className="btn" onClick={() => void addSource()}>
            Ajouter un dossier…
          </button>
          <button
            className="btn"
            disabled={sources.length === 0}
            onClick={() => void window.epikodi.scan.start()}
          >
            Tout réindexer
          </button>
        </div>
        {sources.length === 0 && <p className="empty">Aucun dossier pour l’instant.</p>}
        <ul className="sources">
          {sources.map((s) => {
            const p = progress[s.id];
            return (
              <li key={s.id}>
                <div className="source-main">
                  <span className="kind">{KINDS.find((k) => k.value === s.kind)?.label}</span>
                  <span className="path" title={s.path}>
                    {s.path}
                  </span>
                  <button
                    className="icon-btn"
                    title="Réindexer"
                    onClick={() => void window.epikodi.scan.start(s.id)}
                  >
                    ↻
                  </button>
                  <button className="icon-btn" title="Retirer" onClick={() => void removeSource(s)}>
                    ✕
                  </button>
                </div>
                {p && (
                  <div className={`scan ${p.done ? 'done' : 'running'}`}>
                    {p.done
                      ? p.error
                        ? `Erreur : ${p.error}`
                        : `Terminé — ${p.indexed} indexé${p.indexed > 1 ? 's' : ''}, ${p.skipped} inchangé${p.skipped > 1 ? 's' : ''}, ${p.removed} disparu${p.removed > 1 ? 's' : ''}${p.rejected ? `, ${p.rejected} illisible${p.rejected > 1 ? 's' : ''}` : ''}`
                      : `Indexation… ${p.scanned} fichier${p.scanned > 1 ? 's' : ''} — ${p.current?.split(/[\\/]/).pop() ?? ''}`}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2>Affichage</h2>
        <label className="row">
          <input type="checkbox" checked={tvMode} onChange={onToggleTv} />
          Mode TV — texte et cartes plus grands, lisibles à distance (Ctrl+T)
        </label>
        <p className="hint">
          Navigation : flèches pour se déplacer, Entrée pour ouvrir, Échap / Retour arrière pour
          revenir, « / » pour chercher, P sur une carte pour lire directement. Manette : croix /
          stick, A = Entrée, B = Retour, Y = Recherche, Start = lecture/pause.
        </p>
      </section>

      <section>
        <h2>Base de données</h2>
        <div className="row">
          <button className="btn" onClick={() => void backup()}>
            Sauvegarder…
          </button>
          <button className="btn" onClick={() => void restore()}>
            Restaurer…
          </button>
        </div>
        {message && <p className="hint">{message}</p>}
      </section>
    </div>
  );
}
