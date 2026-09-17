#pragma once
#include <QObject>
#include <QDir>
#include <QVariantList>
#include <QVariantMap>
#include <QDateTime>
#include <QTextStream>

class Bridge : public QObject {
    Q_OBJECT
public:
    explicit Bridge(QObject *parent = nullptr) : QObject(parent) {}

    Q_INVOKABLE QVariantList listDir(const QString &path) const {
        QDir dir(path.isEmpty() ? QDir::homePath() : path);
        QVariantList out;
        for (const QFileInfo &fi : dir.entryInfoList(QDir::AllEntries | QDir::NoDotAndDotDot | QDir::Hidden)) {
            QVariantMap e;
            e["name"] = fi.fileName();
            e["isDir"] = fi.isDir();
            out.append(e);
        }
        return out;
    }

    Q_INVOKABLE void ready() const {
        QTextStream(stdout) << "READY " << QDateTime::currentMSecsSinceEpoch() << Qt::endl;
    }
};
