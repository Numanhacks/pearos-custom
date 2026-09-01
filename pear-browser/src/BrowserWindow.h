#pragma once
#include <QMainWindow>
#include <QTabWidget>
#include <QLineEdit>
#include <QWebEngineView>
#include <QProgressBar>
#include <QToolButton>

class QStackedWidget;

// pear-browser main window — macOS-style UI shell over QtWebEngine (Chromium).
//
// Design: unified toolbar (traffic lights left, omnibox center, actions right),
// rounded omnibox, floating tab bar, page-load progress as a thin top strip.
// All rendering goes through one Chromium engine instance shared by all tabs.
class BrowserWindow : public QMainWindow
{
    Q_OBJECT
public:
    explicit BrowserWindow(QWidget *parent = nullptr);

private slots:
    void newTab(const QUrl &url = QUrl("pear://home"));
    void closeTab(int index);
    void navigate();
    void updateOmnibox(const QUrl &url);
    void tabChanged(int index);
    void loadProgress(int pct);

private:
    QWidget   *buildToolbar();
    QWidget   *startPage();                       // pear://home
    QWebEngineView *currentView() const;

    QTabWidget   *m_tabs;
    QLineEdit    *m_omnibox;
    QProgressBar *m_progress;
    QToolButton  *m_back, *m_fwd, *m_reload;
    QWebEngineProfile *m_profile;                // shared profile: one cache,
                                                 // one interceptor for all tabs
};
