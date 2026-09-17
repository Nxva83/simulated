#include "MediaFormats.h"

#include <QFileInfo>

namespace epikodi {

namespace {
const QStringList kVideo = {"mp4", "m4v", "mkv",  "webm", "avi",  "mov", "wmv",
                            "flv", "ts",  "m2ts", "mpg",  "mpeg", "3gp", "ogv"};
const QStringList kAudio = {"mp3", "flac", "aac", "m4a", "ogg",
                            "oga", "opus", "wav", "wma", "aiff"};

QString joinGlobs(const QStringList& exts) {
    QStringList globs;
    for (const QString& e : exts) {
        globs << "*." + e;
    }
    return globs.join(' ');
}
} // namespace

MediaFormats::MediaFormats(QObject* parent) : QObject(parent) {}

QStringList MediaFormats::videoExtensions() {
    return kVideo;
}
QStringList MediaFormats::audioExtensions() {
    return kAudio;
}

QStringList MediaFormats::nameFilters() {
    return {QStringLiteral("Médias (%1 %2)").arg(joinGlobs(kVideo), joinGlobs(kAudio)),
            QStringLiteral("Vidéos (%1)").arg(joinGlobs(kVideo)),
            QStringLiteral("Audio (%1)").arg(joinGlobs(kAudio)),
            QStringLiteral("Tous les fichiers (*)")};
}

QString MediaFormats::extensionOf(const QUrl& url) {
    const QString path = url.isLocalFile() ? url.toLocalFile() : url.path();
    return QFileInfo(path).suffix().toLower();
}

bool MediaFormats::isVideo(const QUrl& url) {
    return kVideo.contains(extensionOf(url));
}
bool MediaFormats::isAudio(const QUrl& url) {
    return kAudio.contains(extensionOf(url));
}
bool MediaFormats::isSupported(const QUrl& url) {
    return isVideo(url) || isAudio(url);
}

} // namespace epikodi
