// pear-browser entry point
#include "BrowserWindow.h"
#include <QApplication>

int main(int argc, char *argv[])
{
    // Shared Chromium GL context across tabs; needs to be set pre-app
    qputenv("QTWEBENGINE_CHROMIUM_FLAGS",
            "--enable-gpu-rasterization --enable-zero-copy "
            "--ignore-gpu-blocklist --enable-features=VaapiVideoDecoder");

    QApplication app(argc, argv);
    app.setApplicationName("Pear Browser");
    app.setOrganizationName("pearOS");
    app.setWindowIcon(QIcon(":/browser.svg"));

    BrowserWindow win;
    win.show();
    return app.exec();
}
