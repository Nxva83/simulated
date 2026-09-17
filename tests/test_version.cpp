#include "core/Version.h"

#include <QTest>

class TestVersion : public QObject {
    Q_OBJECT
private slots:
    void versionStringMatchesComponents() {
        const QString expected = QStringLiteral("%1.%2.%3")
                                     .arg(epikodi::versionMajor())
                                     .arg(epikodi::versionMinor())
                                     .arg(epikodi::versionPatch());
        QCOMPARE(QString::fromLatin1(epikodi::version()), expected);
    }

    void versionIsSemver() {
        const QStringList parts = QString::fromLatin1(epikodi::version()).split('.');
        QCOMPARE(parts.size(), 3);
        for (const QString& p : parts) {
            bool ok = false;
            p.toInt(&ok);
            QVERIFY(ok);
        }
    }
};

QTEST_GUILESS_MAIN(TestVersion)
#include "test_version.moc"
