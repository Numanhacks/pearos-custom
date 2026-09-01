// pear-browser — request interceptor: privacy + speed (ads & trackers never load)
#include "RequestInterceptor.h"

namespace {
// Domain substrings blocked before any connection is made. This is the
// single biggest page-speed win: no requests, no DNS, no layout thrash.
const char* kBlocked[] = {
    "doubleclick.net", "googlesyndication.com", "googleadservices.com",
    "google-analytics.com", "googletagmanager.com", "googletagservices.com",
    "adservice.google.", "pagead2.googlesyndication.",
    "facebook.net", "connect.facebook.net", "graph.facebook.com",
    "scorecardresearch.com", "quantserve.com", "hotjar.com", "mouseflow.com",
    "criteo.com", "criteo.net", "taboola.com", "outbrain.com",
    "adnxs.com", "adsrvr.org", "amazon-adsystem.com", "moatads.com",
    "pubmatic.com", "rubiconproject.com", "openx.net", "smartadserver.com",
    "zedo.com", "adcolony.com", "chartboost.com", "applovin.com",
    "sentry-cdn.com", "clarity.ms", "branch.io", "mixpanel.com", "segment.io",
};
}

void RequestInterceptor::interceptRequest(QWebEngineUrlRequestInfo &info)
{
    const QString url = info.requestUrl().host() + info.requestUrl().path();
    for (const char *b : kBlocked) {
        if (url.contains(QString::fromLatin1(b), Qt::CaseInsensitive)) {
            info.block(true);
            return;
        }
    }
}
