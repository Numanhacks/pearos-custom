#include <QGuiApplication>
#include <QQmlApplicationEngine>
#include <QQmlContext>
#include <QSysInfo>
#include <QFile>
#include <QProcess>
#include <QCryptographicHash>

static QString readPearOSVersion() {
    QFile f("/etc/pearos-release");
    if (f.open(QIODevice::ReadOnly)) return QString::fromUtf8(f.readAll()).trimmed();
    QFile a("/etc/arch-release");
    if (a.open(QIODevice::ReadOnly)) return QString::fromUtf8(a.readAll()).trimmed();
    return QSysInfo::prettyProductName();
}
static QString hardwareModel() {
    QFile f("/sys/class/dmi/id/product_name");
    if (f.open(QIODevice::ReadOnly)) return QString::fromUtf8(f.readAll()).trimmed();
    QProcess p; p.start("dmidecode", {"-s","system-product-name"}); if(p.waitForFinished(500)) return QString::fromUtf8(p.readAllStandardOutput()).trimmed();
    return "pearOS Mac";
}
static QString cpuInfo() {
    QFile f("/proc/cpuinfo");
    if (f.open(QIODevice::ReadOnly)) {
        auto d=f.readAll(); int i=d.indexOf("model name"); if(i>=0){ auto line=d.mid(i,d.indexOf("\n",i)-i); auto parts=line.split(':'); if(parts.size()>1) return QString::fromUtf8(parts[1].trimmed());}
    }
    return QSysInfo::currentCpuArchitecture();
}
static QString memInfo() {
    QFile f("/proc/meminfo");
    if (f.open(QIODevice::ReadOnly)) {
        auto d=f.readAll(); int i=d.indexOf("MemTotal:"); if(i>=0){ auto line=d.mid(i,d.indexOf("\n",i)-i); return QString::fromUtf8(line).simplified(); }
    }
    return "";
}
static QString gpuInfo() {
    QProcess p; p.start("sh", {"-c","lspci 2>/dev/null | grep -i 'vga\\|3d\\|display' | head -1 | cut -d: -f3- | xargs"}); if(p.waitForFinished(1000)) return QString::fromUtf8(p.readAllStandardOutput()).trimmed();
    return "Apple GPU";
}
static QString serialHash() {
    QFile f("/etc/machine-id");
    QString mid="pearos-serial";
    if(f.open(QIODevice::ReadOnly)) mid=QString::fromUtf8(f.readAll()).trimmed();
    auto h=QCryptographicHash::hash(mid.toUtf8(),QCryptographicHash::Sha256).toHex().toUpper();
    return h.left(12);
}

int main(int argc,char *argv[]){
    QGuiApplication app(argc,argv);
    QGuiApplication::setApplicationName("pearos-about-mac");
    QQmlApplicationEngine engine;
    engine.rootContext()->setContextProperty("pearosVersion", readPearOSVersion());
    engine.rootContext()->setContextProperty("hardwareModel", hardwareModel());
    engine.rootContext()->setContextProperty("cpuModel", cpuInfo());
    engine.rootContext()->setContextProperty("memModel", memInfo());
    engine.rootContext()->setContextProperty("gpuModel", gpuInfo());
    engine.rootContext()->setContextProperty("serialNumber", serialHash());
    engine.load(QUrl(QStringLiteral("qrc:/PearAboutMac/src/main.qml")));
    if(engine.rootObjects().isEmpty()) return -1;
    return app.exec();
}
