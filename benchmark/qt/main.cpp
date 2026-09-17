#include <QGuiApplication>
#include <QQmlApplicationEngine>
#include <QQmlContext>
#include <QQuickWindow>
#include "bridge.h"

int main(int argc, char *argv[]) {
    QGuiApplication app(argc, argv);
    Bridge bridge;
    QQmlApplicationEngine engine;
    engine.rootContext()->setContextProperty("bridge", &bridge);
    QObject::connect(&engine, &QQmlApplicationEngine::objectCreationFailed, &app,
                     [] { QCoreApplication::exit(1); }, Qt::QueuedConnection);
    engine.loadFromModule("EpikodiBench", "Main");

    // READY = premiere frame reellement affichee (equivalent du double requestAnimationFrame cote web).
    auto *win = qobject_cast<QQuickWindow *>(engine.rootObjects().first());
    auto conn = std::make_shared<QMetaObject::Connection>();
    *conn = QObject::connect(win, &QQuickWindow::frameSwapped, &app, [&bridge, conn] {
        bridge.ready();
        QObject::disconnect(*conn);
    });
    return app.exec();
}
