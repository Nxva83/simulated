#include "media/Player.h"

#include <QAudioDevice>
#include <QMediaDevices>
#include <QSignalSpy>
#include <QTest>

#include <chrono>

using epikodi::Player;
using namespace std::chrono_literals;

// Attend qu'une condition devienne vraie (portable : QTRY_* declenche -Wconversion sur Qt 6.9).
#define WAIT_FOR(cond, timeout)                                                                    \
    QVERIFY(QTest::qWaitFor([&] { return static_cast<bool>(cond); }, timeout))

namespace {
QUrl fixture(const char* name) {
    return QUrl::fromLocalFile(QStringLiteral(EPIKODI_FIXTURES_DIR "/") + name);
}

// Charge un fichier et attend que le backend l'ait analyse (ou rejete).
void loadAndWait(Player& p, const char* name) {
    p.setSource(fixture(name));
    WAIT_FOR(p.status() == Player::Status::Loaded || p.status() == Player::Status::Error, 10000);
}
} // namespace

class TestPlayer : public QObject {
    Q_OBJECT
private slots:
    void initialState() {
        Player p;
        QCOMPARE(p.status(), Player::Status::NoMedia);
        QVERIFY(p.errorMessage().isEmpty());
        QVERIFY(!p.playing());
        QCOMPARE(p.duration(), 0);
    }

    // Critere d'acceptation #2 : MP4 H.264/AAC.
    void loadsMp4H264Aac() {
        Player p;
        loadAndWait(p, "pattern-h264-aac.mp4");
        QCOMPARE(p.status(), Player::Status::Loaded);
        QVERIFY(p.hasVideo());
        QVERIFY(p.hasAudio());
        QVERIFY2(qAbs(p.duration() - 3000) < 300, qPrintable(QString::number(p.duration())));
        QVERIFY(p.seekable());
    }

    // Spike de l'ADR 0001 : un MKV HEVC + AC3, que les WebView ne savent pas decoder.
    void loadsMkvHevcAc3() {
        Player p;
        loadAndWait(p, "pattern-hevc-ac3.mkv");
        QVERIFY2(p.status() == Player::Status::Loaded, qPrintable(p.errorMessage()));
        QVERIFY(p.hasVideo());
        QVERIFY(p.hasAudio());
        QVERIFY(qAbs(p.duration() - 3000) < 300);
    }

    // Critere d'acceptation #2 : MP3.
    void loadsMp3() {
        Player p;
        loadAndWait(p, "tone.mp3");
        QCOMPARE(p.status(), Player::Status::Loaded);
        QVERIFY(p.hasAudio());
        QVERIFY(!p.hasVideo());
        QVERIFY(qAbs(p.duration() - 3000) < 300);
    }

    void loadsFlac() {
        Player p;
        loadAndWait(p, "tone.flac");
        QCOMPARE(p.status(), Player::Status::Loaded);
        QVERIFY(p.hasAudio());
    }

    void seeks() {
        Player p;
        loadAndWait(p, "pattern-h264-aac.mp4");
        QCOMPARE(p.status(), Player::Status::Loaded);
        p.seek(1500);
        WAIT_FOR(qAbs(p.position() - 1500) < 250, 5s);
        p.seekBy(-1000);
        WAIT_FOR(qAbs(p.position() - 500) < 250, 5s);
        p.seek(-42); // borne basse
        WAIT_FOR(p.position() < 250, 5s);
        p.seek(99999); // borne haute
        WAIT_FOR(p.position() >= p.duration() - 250, 5s);
    }

    void volumeIsClampedAndRoundTrips() {
        Player p;
        p.setVolume(0.5);
        QVERIFY(qAbs(p.volume() - 0.5) < 0.01);
        p.setVolume(1.7);
        QVERIFY(qAbs(p.volume() - 1.0) < 0.01);
        p.setVolume(-3);
        QVERIFY(p.volume() < 0.01);
        QVERIFY(!p.muted());
        p.setMuted(true);
        QVERIFY(p.muted());
    }

    void playsAndAdvances() {
        if (QMediaDevices::defaultAudioOutput().isNull()) {
            QTest::qSkip("Pas de sortie audio : lecture non testable sur cette machine.", __FILE__,
                         __LINE__);
            return;
        }
        Player p;
        loadAndWait(p, "pattern-h264-aac.mp4");
        QCOMPARE(p.status(), Player::Status::Loaded);
        p.play();
        WAIT_FOR(p.playing(), 5s);
        WAIT_FOR(p.position() > 300, 5s);
        p.pause();
        WAIT_FOR(!p.playing(), 5s);
        const qint64 paused = p.position();
        QTest::qWait(300);
        QVERIFY(qAbs(p.position() - paused) < 100);
    }

    // Critere d'acceptation #2 : un format non supporte affiche un message clair.
    void rejectsUnsupportedExtensionImmediately() {
        Player p;
        QSignalSpy spy(&p, &Player::errorMessageChanged);
        p.setSource(fixture("unsupported.xyz"));
        QCOMPARE(p.status(), Player::Status::Error); // synchrone, sans passer par le backend
        QCOMPARE(spy.count(), 1);
        QVERIFY2(p.errorMessage().contains(".xyz"), qPrintable(p.errorMessage()));
        p.play();
        QVERIFY(!p.playing());
    }

    void reportsMissingFile() {
        Player p;
        p.setSource(QUrl::fromLocalFile("/nulle/part/film.mkv"));
        QCOMPARE(p.status(), Player::Status::Error);
        QVERIFY(p.errorMessage().contains("introuvable"));
    }

    void reportsCorruptFile() {
        Player p;
        loadAndWait(p, "corrupt.mp4");
        QCOMPARE(p.status(), Player::Status::Error);
        QVERIFY(!p.errorMessage().isEmpty());
    }

    void recoversAfterError() {
        Player p;
        p.setSource(fixture("unsupported.xyz"));
        QCOMPARE(p.status(), Player::Status::Error);
        loadAndWait(p, "tone.mp3");
        QCOMPARE(p.status(), Player::Status::Loaded);
        QVERIFY(p.errorMessage().isEmpty());
    }

    void clearingSourceResets() {
        Player p;
        loadAndWait(p, "tone.mp3");
        p.setSource(QUrl());
        QCOMPARE(p.status(), Player::Status::NoMedia);
    }
};

QTEST_MAIN(TestPlayer)
#include "test_player.moc"
