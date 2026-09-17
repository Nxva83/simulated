#include "Player.h"

#include "MediaFormats.h"

#include <QAudio>
#include <QFileInfo>

#include <algorithm>

namespace epikodi {

Player::Player(QObject* parent) : QObject(parent) {
    m_player.setAudioOutput(&m_audio);

    connect(&m_player, &QMediaPlayer::mediaStatusChanged, this, &Player::onMediaStatusChanged);
    connect(&m_player, &QMediaPlayer::errorOccurred, this, &Player::onErrorOccurred);
    connect(&m_player, &QMediaPlayer::playingChanged, this, &Player::playingChanged);
    connect(&m_player, &QMediaPlayer::positionChanged, this, &Player::positionChanged);
    connect(&m_player, &QMediaPlayer::durationChanged, this, &Player::durationChanged);
    connect(&m_player, &QMediaPlayer::seekableChanged, this, &Player::seekableChanged);
    connect(&m_player, &QMediaPlayer::hasVideoChanged, this, &Player::hasVideoChanged);
    connect(&m_player, &QMediaPlayer::hasAudioChanged, this, &Player::hasAudioChanged);
    connect(&m_audio, &QAudioOutput::volumeChanged, this, &Player::volumeChanged);
    connect(&m_audio, &QAudioOutput::mutedChanged, this, &Player::mutedChanged);
}

void Player::setSource(const QUrl& url) {
    if (url == m_source) {
        return;
    }
    m_source = url;
    emit sourceChanged();
    clearError();

    if (url.isEmpty()) {
        m_player.setSource({});
        setStatus(Status::NoMedia);
        return;
    }
    if (!MediaFormats::isSupported(url)) {
        const QString ext = MediaFormats::extensionOf(url);
        m_player.setSource({});
        setError(ext.isEmpty()
                     ? QStringLiteral("Ce fichier n'a pas d'extension reconnue.")
                     : QStringLiteral("Le format « .%1 » n'est pas pris en charge.").arg(ext));
        return;
    }
    if (url.isLocalFile() && !QFileInfo::exists(url.toLocalFile())) {
        m_player.setSource({});
        setError(QStringLiteral("Fichier introuvable : %1").arg(url.toLocalFile()));
        return;
    }
    setStatus(Status::Loading);
    m_player.setSource(url);
}

QVideoSink* Player::videoSink() const {
    return m_player.videoSink();
}

void Player::setVideoSink(QVideoSink* sink) {
    if (sink == m_player.videoSink()) {
        return;
    }
    m_player.setVideoSink(sink);
    emit videoSinkChanged();
}

bool Player::playing() const {
    return m_player.isPlaying();
}
qint64 Player::position() const {
    return m_player.position();
}
qint64 Player::duration() const {
    return m_player.duration();
}
bool Player::seekable() const {
    return m_player.isSeekable();
}
bool Player::hasVideo() const {
    return m_player.hasVideo();
}
bool Player::hasAudio() const {
    return m_player.hasAudio();
}

qreal Player::volume() const {
    return QAudio::convertVolume(m_audio.volume(), QAudio::LinearVolumeScale,
                                 QAudio::LogarithmicVolumeScale);
}

void Player::setVolume(qreal volume) {
    const float clamped = static_cast<float>(std::clamp(volume, 0.0, 1.0));
    m_audio.setVolume(
        QAudio::convertVolume(clamped, QAudio::LogarithmicVolumeScale, QAudio::LinearVolumeScale));
}

bool Player::muted() const {
    return m_audio.isMuted();
}
void Player::setMuted(bool muted) {
    m_audio.setMuted(muted);
}

void Player::play() {
    if (m_status == Status::Error || m_source.isEmpty()) {
        return;
    }
    m_player.play();
}

void Player::pause() {
    m_player.pause();
}
void Player::stop() {
    m_player.stop();
}

void Player::togglePlayPause() {
    if (playing()) {
        pause();
    } else {
        play();
    }
}

void Player::seek(qint64 positionMs) {
    if (!seekable()) {
        return;
    }
    m_player.setPosition(std::clamp<qint64>(positionMs, 0, std::max<qint64>(duration(), 0)));
}

void Player::seekBy(qint64 deltaMs) {
    seek(position() + deltaMs);
}

void Player::setStatus(Status status) {
    if (status == m_status) {
        return;
    }
    m_status = status;
    emit statusChanged();
}

void Player::setError(const QString& message) {
    m_errorMessage = message;
    emit errorMessageChanged();
    setStatus(Status::Error);
}

void Player::clearError() {
    if (!m_errorMessage.isEmpty()) {
        m_errorMessage.clear();
        emit errorMessageChanged();
    }
}

void Player::onMediaStatusChanged(QMediaPlayer::MediaStatus status) {
    switch (status) {
    case QMediaPlayer::NoMedia:
        setStatus(Status::NoMedia);
        break;
    case QMediaPlayer::LoadingMedia:
        setStatus(Status::Loading);
        break;
    case QMediaPlayer::LoadedMedia:
    case QMediaPlayer::BufferedMedia:
        setStatus(Status::Loaded);
        break;
    case QMediaPlayer::StalledMedia:
    case QMediaPlayer::BufferingMedia:
        setStatus(Status::Buffering);
        break;
    case QMediaPlayer::EndOfMedia:
        setStatus(Status::Ended);
        break;
    case QMediaPlayer::InvalidMedia:
        if (m_status != Status::Error) {
            setError(QStringLiteral("Ce fichier est illisible ou corrompu."));
        }
        break;
    }
}

void Player::onErrorOccurred(QMediaPlayer::Error error, const QString& detail) {
    QString message;
    switch (error) {
    case QMediaPlayer::NoError:
        return;
    case QMediaPlayer::ResourceError:
        message = QStringLiteral("Impossible d'ouvrir le fichier (illisible ou corrompu).");
        break;
    case QMediaPlayer::FormatError:
        message = QStringLiteral("Format ou codec non pris en charge par le décodeur.");
        break;
    case QMediaPlayer::NetworkError:
        message = QStringLiteral("Erreur réseau pendant la lecture.");
        break;
    case QMediaPlayer::AccessDeniedError:
        message = QStringLiteral("Accès refusé à ce fichier.");
        break;
    }
    if (!detail.isEmpty()) {
        message += QStringLiteral(" (%1)").arg(detail);
    }
    setError(message);
}

} // namespace epikodi
