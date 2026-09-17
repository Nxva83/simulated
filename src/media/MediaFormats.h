#pragma once

#include <QObject>
#include <QQmlEngine>
#include <QStringList>
#include <QUrl>

namespace epikodi {

/// Formats de fichiers que le lecteur accepte d'ouvrir (decides par l'extension).
/// Le decodage reel est delegue a Qt Multimedia / FFmpeg ; cette liste sert a filtrer les
/// dialogues d'ouverture et a produire un message clair avant meme de tenter la lecture.
class MediaFormats : public QObject {
    Q_OBJECT
    QML_ELEMENT
    QML_SINGLETON
    Q_PROPERTY(QStringList videoExtensions READ videoExtensions CONSTANT)
    Q_PROPERTY(QStringList audioExtensions READ audioExtensions CONSTANT)
    Q_PROPERTY(QStringList nameFilters READ nameFilters CONSTANT)

public:
    explicit MediaFormats(QObject* parent = nullptr);

    static QStringList videoExtensions();
    static QStringList audioExtensions();

    /// Filtres prets pour un FileDialog QML ("Videos (*.mp4 *.mkv ...)", ...).
    static QStringList nameFilters();

    /// Extension en minuscules sans le point, ou chaine vide.
    static QString extensionOf(const QUrl& url);

    Q_INVOKABLE static bool isSupported(const QUrl& url);
    Q_INVOKABLE static bool isVideo(const QUrl& url);
    Q_INVOKABLE static bool isAudio(const QUrl& url);
};

} // namespace epikodi
