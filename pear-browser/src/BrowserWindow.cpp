#include "BrowserWindow.h"
#include "RequestInterceptor.h"

#include <QWebEngineProfile>
#include <QWebEnginePage>
#include <QWebEngineSettings>
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QLabel>
#include <QPushButton>
#include <QShortcut>
#include <QStyle>

// ─────────────────────────────────────────────────────────────────────────────
BrowserWindow::BrowserWindow(QWidget *parent)
    : QMainWindow(parent)
{
    setWindowTitle("Pear Browser");
    resize(1280, 800);

    // One shared profile for the whole browser: single HTTP disk cache (speed),
    // one interceptor (ad/tracker blocking), persistent cookies.
    m_profile = new QWebEngineProfile("pear-browser", this);
    m_profile->setHttpCacheType(QWebEngineProfile::DiskHttpCache);
    m_profile->setHttpCacheMaximumSize(512 * 1024); // 512 MB cache cap
    m_profile->setUrlRequestInterceptor(new RequestInterceptor(m_profile));

    // Chromium-level speed tuning: GPU rasterization, zero-copy upload,
    // don't blocklist known-good GPUs, VA-API video decode on Linux.
    qputenv("QTWEBENGINE_CHROMIUM_FLAGS",
            "--enable-gpu-rasterization --enable-zero-copy "
            "--ignore-gpu-blocklist --enable-features=VaapiVideoDecoder");

    // ── UI shell ──────────────────────────────────────────────────────────
    auto *central = new QWidget(this);
    auto *root    = new QVBoxLayout(central);
    root->setContentsMargins(0, 0, 0, 0);
    root->setSpacing(0);

    root->addWidget(buildToolbar());

    m_progress = new QProgressBar(central);
    m_progress->setFixedHeight(3);
    m_progress->setTextVisible(false);
    m_progress->setRange(0, 100);
    m_progress->setStyleSheet(
        "QProgressBar{background:transparent;border:none;}"
        "QProgressBar::chunk{background:#0a84ff;border-radius:1px;}");
    root->addWidget(m_progress);

    m_tabs = new QTabWidget(central);
    m_tabs->setTabsClosable(true);
    m_tabs->setMovable(true);
    m_tabs->setDocumentMode(true);
    connect(m_tabs, &QTabWidget::tabCloseRequested, this, &BrowserWindow::closeTab);
    connect(m_tabs, &QTabWidget::currentChanged, this, &BrowserWindow::tabChanged);
    root->addWidget(m_tabs, 1);

    setCentralWidget(central);
    newTab(QUrl("https://www.google.com"));

    // macOS-like chrome: dark frosted toolbar, rounded omnibox, floating tabs
    setStyleSheet(R"(
        QMainWindow, QTabWidget::pane { background:#1e1e20; }
        QTabBar::tab {
            background:#2a2a2e; color:#d8d8dc;
            padding:6px 14px; border-top-left-radius:8px; border-top-right-radius:8px;
            margin:3px 2px 0 2px;
        }
        QTabBar::tab:selected { background:#3a3a40; color:#ffffff; }
        QLineEdit {
            background:#2a2a2e; color:#f2f2f7; border:none;
            border-radius:10px; padding:6px 14px; font-size:13px;
            selection-background-color:#0a84ff;
        }
        QLineEdit:focus { border:2px solid #0a84ff; }
        QToolButton { background:transparent; border:none; border-radius:8px; padding:4px; }
        QToolButton:hover { background:#3a3a40; }
    )");
}

// ─────────────────────────────────────────────────────────────────────────────
QWidget *BrowserWindow::buildToolbar()
{
    auto *bar = new QWidget(this);
    bar->setFixedHeight(48);
    auto *lay = new QHBoxLayout(bar);
    lay->setContentsMargins(12, 6, 12, 6);
    lay->setSpacing(8);

    // traffic lights (visual identity; real window ops stay with the WM)
    auto light = [](const char *color) {
        auto *b = new QPushButton;
        b->setFixedSize(13, 13);
        b->setStyleSheet(QString(
            "QPushButton{background:%1;border:none;border-radius:6px;}").arg(color));
        return b;
    };
    lay->addWidget(light("#ff5f57"));
    lay->addWidget(light("#febc2e"));
    lay->addWidget(light("#28c840"));
    lay->addSpacing(10);

    m_back = new QToolButton(bar);
    m_back->setIcon(style()->standardIcon(QStyle::SP_ArrowBack));
    m_fwd  = new QToolButton(bar);
    m_fwd->setIcon(style()->standardIcon(QStyle::SP_ArrowForward));
    m_reload = new QToolButton(bar);
    m_reload->setIcon(style()->standardIcon(QStyle::SP_BrowserReload));
    lay->addWidget(m_back); lay->addWidget(m_fwd); lay->addWidget(m_reload);

    m_omnibox = new QLineEdit(bar);
    m_omnibox->setPlaceholderText("Search or enter website name");
    lay->addWidget(m_omnibox, 1);
    connect(m_omnibox, &QLineEdit::returnPressed, this, &BrowserWindow::navigate);

    connect(m_back,   &QToolButton::clicked, this, [this] { if (currentView()) currentView()->back(); });
    connect(m_fwd,    &QToolButton::clicked, this, [this] { if (currentView()) currentView()->forward(); });
    connect(m_reload, &QToolButton::clicked, this, [this] { if (currentView()) currentView()->reload(); });

    // shortcuts
    auto addShortcut = [this](const char *seq, auto slot) {
        auto *sc = new QShortcut(QKeySequence(seq), this);
        connect(sc, &QShortcut::activated, this, slot);
    };
    addShortcut("Ctrl+T", [this] { newTab(); });
    addShortcut("Ctrl+W", [this] { closeTab(m_tabs->currentIndex()); });
    addShortcut("Ctrl+L", [this] { m_omnibox->setFocus(); m_omnibox->selectAll(); });
    addShortcut("F5",     [this] { if (currentView()) currentView()->reload(); });

    return bar;
}

QWebEngineView *BrowserWindow::currentView() const
{
    return qobject_cast<QWebEngineView *>(m_tabs->currentWidget());
}

QWidget *BrowserWindow::startPage()
{
    auto *w = new QWidget;
    auto *lay = new QVBoxLayout(w);
    lay->setAlignment(Qt::AlignCenter);
    auto *logo = new QLabel("🍐 Pear Browser", w);
    logo->setStyleSheet("font-size:42px; font-weight:600; color:#f2f2f7;");
    auto *hint = new QLabel("Ctrl+T new tab · Ctrl+W close · Ctrl+L address bar", w);
    hint->setStyleSheet("color:#8e8e93; font-size:13px;");
    lay->addStretch();
    lay->addWidget(logo, 0, Qt::AlignCenter);
    lay->addWidget(hint, 0, Qt::AlignCenter);
    lay->addStretch();
    return w;
}

void BrowserWindow::newTab(const QUrl &url)
{
    if (url.scheme() == "pear") {
        m_tabs->addTab(startPage(), tr("New Tab"));
        m_tabs->setCurrentIndex(m_tabs->count() - 1);
        return;
    }
    auto *page = new QWebEnginePage(m_profile, m_tabs);
    auto *view = new QWebEngineView(m_tabs);
    view->setPage(page);
    view->settings()->setAttribute(QWebEngineSettings::JavascriptCanOpenWindows, false);
    view->settings()->setAttribute(QWebEngineSettings::ScrollAnimatorEnabled, true);

    connect(view, &QWebEngineView::urlChanged,    this, &BrowserWindow::updateOmnibox);
    connect(view, &QWebEngineView::loadProgress,  this, &BrowserWindow::loadProgress);
    connect(view, &QWebEngineView::titleChanged,  this, [this, view](const QString &t) {
        int i = m_tabs->indexOf(view);
        if (i >= 0) m_tabs->setTabText(i, t.isEmpty() ? tr("New Tab") : QString(t).left(24));
    });

    m_tabs->addTab(view, tr("New Tab"));
    m_tabs->setCurrentIndex(m_tabs->count() - 1);
    view->load(url);
}

void BrowserWindow::closeTab(int index)
{
    QWidget *w = m_tabs->widget(index);
    m_tabs->removeTab(index);
    w->deleteLater();
    if (m_tabs->count() == 0) close();
}

void BrowserWindow::navigate()
{
    const QString text = m_omnibox->text().trimmed();
    if (text.isEmpty()) return;
    // QUrl::fromUserInput: "wikipedia cats" -> search, "example.com" -> https://
    if (currentView()) currentView()->load(QUrl::fromUserInput(text));
}

void BrowserWindow::updateOmnibox(const QUrl &url)
{
    if (sender() == currentView())
        m_omnibox->setText(url.toString());
}

void BrowserWindow::tabChanged(int)
{
    if (auto *v = currentView())
        m_omnibox->setText(v->url().toString());
}

void BrowserWindow::loadProgress(int pct)
{
    if (sender() != currentView()) return;
    m_progress->setValue(pct);
    m_progress->setVisible(pct < 100);
}

