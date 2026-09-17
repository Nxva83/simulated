#include "app/QmlHotReloader.h"
#include "core/Version.h"

#include <QGuiApplication>
#include <QQmlApplicationEngine>
#include <QQuickStyle>

int main(int argc, char* argv[]) {
    QGuiApplication app(argc, argv);
    QCoreApplication::setOrganizationName("EPITECH");
    QCoreApplication::setOrganizationDomain("epitech.eu");
    QCoreApplication::setApplicationName("EPIKODI");
    QCoreApplication::setApplicationVersion(QString::fromLatin1(epikodi::version()));

    // Style non natif : rend identique sur les 3 OS et entierement personnalisable (themes).
    QQuickStyle::setStyle("Basic");

    QQmlApplicationEngine engine;
    QObject::connect(
        &engine, &QQmlApplicationEngine::objectCreationFailed, &app,
        [] { QCoreApplication::exit(EXIT_FAILURE); }, Qt::QueuedConnection);

#ifdef EPIKODI_QML_SOURCE_DIR
    // Build Debug : QML charge depuis les sources + rechargement a chaud.
    epikodi::QmlHotReloader reloader(engine, QStringLiteral(EPIKODI_QML_SOURCE_DIR), "Main.qml");
    reloader.start();
#else
    engine.loadFromModule("Epikodi.Ui", "Main");
#endif

    return QGuiApplication::exec();
}
