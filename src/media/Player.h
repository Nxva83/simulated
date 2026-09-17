#pragma once

#include <QAudioOutput>
#include <QMediaPlayer>
#include <QObject>
#include <QQmlEngine>
#include <QString>
#include <QUrl>
#include <QVideoSink>

namespace epikodi {

/// Lecteur multimedia expose a QML. Encapsule QMediaPlayer (backend FFmpeg) et QAudioOutput
/// derriere une API stable : source, play/pause/stop/seek, volume, statut et erreurs lisibles.
/// L'UI ne parle jamais directement a Qt Multimedia : ce type est le seul point d'entree.
class Player : public QObject {
    Q_OBJECT
    QML_ELEMENT

    Q_PROPERTY(QUrl source READ source WRITE setSource NOTIFY sourceChanged)
    Q_PROPERTY(QVideoSink* videoSink READ videoSink WRITE setVideoSink NOTIFY videoSinkChanged)
    Q_PROPERTY(Status status READ status NOTIFY statusChanged)
    Q_PROPERTY(bool playing READ playing NOTIFY playingChanged)
    Q_PROPERTY(qint64 position READ position NOTIFY positionChanged)
    Q_PROPERTY(qint64 duration READ duration NOTIFY durationChanged)
    Q_PROPERTY(bool seekable READ seekable NOTIFY seekableChanged)
    Q_PROPERTY(bool hasVideo READ hasVideo NOTIFY hasVideoChanged)
    Q_PROPERTY(bool hasAudio READ hasAudio NOTIFY hasAudioChanged)
    Q_PROPERTY(qreal volume READ volume WRITE setVolume NOTIFY volumeChanged)
    Q_PROPERTY(bool muted READ muted WRITE setMuted NOTIFY mutedChanged)
    Q_PROPERTY(QString errorMessage READ errorMessage NOTIFY errorMessageChanged)

public:
    enum class Status { NoMedia, Loading, Loaded, Buffering, Ended, Error };
    Q_ENUM(Status)

    explicit Player(QObject* parent = nullptr);

    QUrl source() const { return m_source; }
    void setSource(const QUrl& url);

    QVideoSink* videoSink() const;
    void setVideoSink(QVideoSink* sink);

    Status status() const { return m_status; }
    bool playing() const;
    qint64 position() const;
    qint64 duration() const;
    bool seekable() const;
    bool hasVideo() const;
    bool hasAudio() const;

    /// Volume lineaire percu, entre 0.0 et 1.0.
    qreal volume() const;
    void setVolume(qreal volume);
    bool muted() const;
    void setMuted(bool muted);

    /// Vide tant qu'aucune erreur ; sinon une phrase en francais destinee a l'utilisateur.
    QString errorMessage() const { return m_errorMessage; }

public slots:
    void play();
    void pause();
    void stop();
    void togglePlayPause();
    /// Position absolue en millisecondes (bornee a [0, duration]).
    void seek(qint64 positionMs);
    /// Deplacement relatif en millisecondes (ex. +10000 / -10000).
    void seekBy(qint64 deltaMs);

signals:
    void sourceChanged();
    void videoSinkChanged();
    void statusChanged();
    void playingChanged();
    void positionChanged();
    void durationChanged();
    void seekableChanged();
    void hasVideoChanged();
    void hasAudioChanged();
    void volumeChanged();
    void mutedChanged();
    void errorMessageChanged();

private:
    void setStatus(Status status);
    void setError(const QString& message);
    void clearError();
    void onMediaStatusChanged(QMediaPlayer::MediaStatus status);
    void onErrorOccurred(QMediaPlayer::Error error, const QString& detail);

    QMediaPlayer m_player;
    QAudioOutput m_audio;
    QUrl m_source;
    Status m_status = Status::NoMedia;
    QString m_errorMessage;
};

} // namespace epikodi
