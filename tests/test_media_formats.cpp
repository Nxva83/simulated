#include "media/MediaFormats.h"

#include <QTest>

using epikodi::MediaFormats;

class TestMediaFormats : public QObject {
    Q_OBJECT
private slots:
    void recognisesVideoAndAudio() {
        QVERIFY(MediaFormats::isVideo(QUrl::fromLocalFile("/films/Film.MKV")));
        QVERIFY(MediaFormats::isVideo(QUrl::fromLocalFile("/films/clip.mp4")));
        QVERIFY(MediaFormats::isAudio(QUrl::fromLocalFile("/musique/piste.flac")));
        QVERIFY(!MediaFormats::isAudio(QUrl::fromLocalFile("/films/clip.mp4")));
        QVERIFY(!MediaFormats::isVideo(QUrl::fromLocalFile("/musique/piste.flac")));
    }

    void rejectsUnknownOrMissingExtension() {
        QVERIFY(!MediaFormats::isSupported(QUrl::fromLocalFile("/tmp/notes.txt")));
        QVERIFY(!MediaFormats::isSupported(QUrl::fromLocalFile("/tmp/sans-extension")));
        QVERIFY(!MediaFormats::isSupported(QUrl()));
    }

    void extensionIsLowercaseWithoutDot() {
        QCOMPARE(MediaFormats::extensionOf(QUrl::fromLocalFile("/a/B.Mp4")), QString("mp4"));
        QCOMPARE(MediaFormats::extensionOf(QUrl("https://ex.org/stream/video.WEBM?x=1")),
                 QString("webm"));
        QCOMPARE(MediaFormats::extensionOf(QUrl::fromLocalFile("/a/README")), QString());
    }

    void nameFiltersCoverEveryExtension() {
        const QString all = MediaFormats::nameFilters().join(' ');
        for (const QString& e : MediaFormats::videoExtensions() + MediaFormats::audioExtensions()) {
            QVERIFY2(all.contains("*." + e), qPrintable("manque *." + e));
        }
        QVERIFY(MediaFormats::nameFilters().last().contains("*"));
    }
};

QTEST_GUILESS_MAIN(TestMediaFormats)
#include "test_media_formats.moc"
