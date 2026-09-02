#include <QGuiApplication>
#include <QQmlApplicationEngine>
int main(int argc,char*argv[]){ QGuiApplication a(argc,argv); QQmlApplicationEngine e; e.load(QUrl("qrc:/Launchpad/src/main.qml")); return a.exec(); }
