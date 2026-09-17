#include "QmlHotReloader.h"

#include <QDebug>
#include <QDir>
#include <QDirIterator>
#include <QQmlApplicationEngine>
#include <QUrl>

namespace epikodi {

QmlHotReloader::QmlHotReloader(QQmlApplicationEngine& engine, QString sourceDir, QString mainFile,
                               QObject* parent)
    : QObject(parent), m_engine(engine), m_sourceDir(std::move(sourceDir)),
      m_mainFile(std::move(mainFile)) {
    // Les editeurs ecrivent souvent en plusieurs etapes : on regroupe les evenements.
    m_debounce.setSingleShot(true);
    m_debounce.setInterval(150);
    connect(&m_debounce, &QTimer::timeout, this, &QmlHotReloader::reload);

    auto schedule = [this](const QString& path) {
        if (QFileInfo(path).isDir()) {
            watchRecursively(path); // nouveaux fichiers/dossiers
        }
        m_debounce.start();
    };
    connect(&m_watcher, &QFileSystemWatcher::fileChanged, this, schedule);
    connect(&m_watcher, &QFileSystemWatcher::directoryChanged, this, schedule);
}

void QmlHotReloader::start() {
    watchRecursively(m_sourceDir);
    qInfo().noquote() << "[hot-reload] QML charge depuis" << m_sourceDir;
    reload();
}

void QmlHotReloader::watchRecursively(const QString& dir) {
    m_watcher.addPath(dir);
    QDirIterator it(dir, QDir::Files | QDir::Dirs | QDir::NoDotAndDotDot,
                    QDirIterator::Subdirectories);
    while (it.hasNext()) {
        const QString path = it.next();
        if (QFileInfo(path).isDir() || path.endsWith(".qml") || path.endsWith(".js")) {
            m_watcher.addPath(path);
        }
    }
}

void QmlHotReloader::reload() {
    // Certains editeurs remplacent le fichier : le watcher perd le chemin, on le re-ajoute.
    watchRecursively(m_sourceDir);

    const auto roots = m_engine.rootObjects();
    for (QObject* root : roots) {
        root->deleteLater();
    }
    m_engine.clearComponentCache();
    m_engine.load(QUrl::fromLocalFile(QDir(m_sourceDir).filePath(m_mainFile)));
    qInfo().noquote() << "[hot-reload] interface rechargee";
}

} // namespace epikodi
