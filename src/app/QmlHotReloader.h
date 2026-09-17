#pragma once

#include <QFileSystemWatcher>
#include <QObject>
#include <QString>
#include <QTimer>

class QQmlApplicationEngine;

namespace epikodi {

/// Recharge l'interface QML des qu'un fichier du dossier surveille change (dev uniquement).
/// Remplace le "hot-reload" d'un bundler web : sauvegarder un .qml met la fenetre a jour.
class QmlHotReloader : public QObject {
    Q_OBJECT
public:
    QmlHotReloader(QQmlApplicationEngine& engine, QString sourceDir, QString mainFile,
                   QObject* parent = nullptr);

    /// Premier chargement + mise en place de la surveillance.
    void start();

private:
    void watchRecursively(const QString& dir);
    void reload();

    QQmlApplicationEngine& m_engine;
    QString m_sourceDir;
    QString m_mainFile;
    QFileSystemWatcher m_watcher;
    QTimer m_debounce;
};

} // namespace epikodi
