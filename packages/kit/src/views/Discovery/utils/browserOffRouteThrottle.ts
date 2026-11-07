import type { IElectronWebView } from '@onekeyhq/kit/src/components/WebView/types';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  injectToPauseWebsocketOffRoute,
  injectToReportPageHidden,
  injectToReportPageVisible,
  injectToResumeWebsocketOffRoute,
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

/**
 * Inject into one WebView. Electron reports "not attached / not ready" both as a
 * synchronous throw and as a rejected promise depending on how far the guest
 * got, so both have to be absorbed — an unhandled rejection here would surface
 * as a console error on a path that is expected to miss sometimes.
 */
function injectIntoWebview(id: string, code: string): boolean {
  const innerRef = webviewRefs[id]?.innerRef as IElectronWebView | undefined;
  if (!innerRef) {
    return false;
  }
  try {
    const result = innerRef.executeJavaScript(code) as unknown;
    if (result && typeof (result as Promise<unknown>).then === 'function') {
      (result as Promise<unknown>).catch(() => {
        // guest went away or was not ready; the next transition re-applies
      });
    }
    return true;
  } catch {
    // A WebView that is not dom-ready yet cannot be reached, and it does not
    // need to be: it has nothing running to throttle, and both the next
    // transition and its own dom-ready re-apply the current state.
    return false;
  }
}

function injectIntoAllWebviews(code: string, label: string): number {
  const ids = Object.keys(webviewRefs);
  let applied = 0;
  for (const id of ids) {
    if (injectIntoWebview(id, code)) {
      applied += 1;
    }
  }
  // `applied` counts injections issued, not landed, and `total` counts entries
  // in webviewRefs — neither is a count of guest renderer processes, which also
  // include out-of-process iframes and popups that this pass cannot reach.
  defaultLogger.discovery.browser.offRouteThrottle({
    label,
    applied,
    total: ids.length,
  });
  return applied;
}

const PAUSE_SCRIPT = `${injectToPauseWebsocketOffRoute};${injectToReportPageHidden}`;
const RESUME_SCRIPT = `${injectToResumeWebsocketOffRoute};${injectToReportPageVisible}`;

export function throttleBrowserWebviewsOffRoute() {
  if (!platformEnv.isDesktop || isThrottled) {
    return;
  }
  isThrottled = true;
  injectIntoAllWebviews(PAUSE_SCRIPT, 'pause');
}

export function restoreBrowserWebviewsOnRoute() {
  if (!platformEnv.isDesktop || !isThrottled) {
    return;
  }
  isThrottled = false;
  injectIntoAllWebviews(RESUME_SCRIPT, 'resume');
}

/**
 * Bring a single WebView in line with the current throttle state.
 *
 * Called from two places on purpose, because neither covers the other:
 * - the wrapper ref publish, which is the only signal for a document that was
 *   already dom-ready before the ref reached `webviewRefs`;
 * - `dom-ready`, which is the only signal for a tab whose ref publish cannot
 *   fire (`useImperativeHandle` is a layout effect, so a tab frozen by
 *   react-freeze never runs it) and for a guest that reloads or navigates while
 *   off-route, since a new document starts with none of the patches applied.
 *
 * Both scripts are idempotent, so running twice is harmless.
 */
export function applyCurrentThrottleStateToWebview(id: string) {
  if (!platformEnv.isDesktop || !isThrottled) {
    return;
  }
  injectIntoWebview(id, PAUSE_SCRIPT);
}

export function getBrowserOffRouteThrottleState() {
  return isThrottled;
}
