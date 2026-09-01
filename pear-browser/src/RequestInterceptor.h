#pragma once
#include <QWebEngineUrlRequestInterceptor>

// Blocks ad/tracker requests at the network layer (before DNS).
// Also acts as the hook point for future per-site privacy profiles.
class RequestInterceptor : public QWebEngineUrlRequestInterceptor
{
    Q_OBJECT
public:
    using QWebEngineUrlRequestInterceptor::QWebEngineUrlRequestInterceptor;
    void interceptRequest(QWebEngineUrlRequestInfo &info) override;
};
