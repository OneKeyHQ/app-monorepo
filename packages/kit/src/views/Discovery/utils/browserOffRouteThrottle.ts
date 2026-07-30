import type { IElectronWebView } from '@onekeyhq/kit/src/components/WebView/types';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  injectToPauseWebsocket,
  injectToReportPageHidden,
  injectToReportPageVisible,
  injectToResumeWebsocket,
  webviewRefs,
} from './explorerUtils';

/**
 * Throttle every live DApp WebView while the user is away from the browser
 * route.
 *
 * Keep-alive deliberately holds those WebViews mounted so revisiting a tab does
 * not reload it, but a mounted <webview> keeps running at full speed even when
 * no part of it is on screen — an idle overnight session with trading tabs open
 * spent most of its CPU inside those guest processes. Nothing here unmounts or
 * reloads anything: we only tell each page it is hidden (and stop outbound
 * WebSocket traffic) so the site's own background handling engages, then undo
 * both on return.
 *
 * Runtime scope: called from the desktop window renderer; the injected code
 * runs in each guest WebView. `webviewRefs` is module state in that same
 * renderer, so there is no bg-runtime involvement.
 */

let isThrottled = false;

function injectIntoAllWebviews(code: string, label: string): number {
  let applied = 0;
  for (const id of Object.keys(webviewRefs)) {
    const innerRef = webviewRefs[id]?.innerRef as IElectronWebView | undefined;
    if (!innerRef) {
      continue;
    }
    try {
      innerRef.executeJavaScript(code);
      applied += 1;
    } catch {
      // A WebView that is not dom-ready yet cannot be reached, and it does not
      // need to be: it has nothing running to throttle, and the next
      // transition re-applies the current state.
    }
  }
  defaultLogger.discovery.browser.offRouteThrottle({ label, applied });
  return applied;
}

export function throttleBrowserWebviewsOffRoute() {
  if (!platformEnv.isDesktop || isThrottled) {
    return;
  }
  isThrottled = true;
  injectIntoAllWebviews(
    `${injectToPauseWebsocket};${injectToReportPageHidden}`,
    'pause',
  );
}

export function restoreBrowserWebviewsOnRoute() {
  if (!platformEnv.isDesktop || !isThrottled) {
    return;
  }
  isThrottled = false;
  injectIntoAllWebviews(
    `${injectToResumeWebsocket};${injectToReportPageVisible}`,
    'resume',
  );
}

/**
 * A WebView created while off-route starts out un-throttled, so bring it in
 * line with the current state once it is ready.
 */
export function applyCurrentThrottleStateToWebview(id: string) {
  if (!platformEnv.isDesktop || !isThrottled) {
    return;
  }
  const innerRef = webviewRefs[id]?.innerRef as IElectronWebView | undefined;
  if (!innerRef) {
    return;
  }
  try {
    innerRef.executeJavaScript(
      `${injectToPauseWebsocket};${injectToReportPageHidden}`,
    );
  } catch {
    // not dom-ready; the next transition covers it
  }
}

export function getBrowserOffRouteThrottleState() {
  return isThrottled;
}
