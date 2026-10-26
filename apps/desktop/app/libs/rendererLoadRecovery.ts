// The packaged renderer is served from file:// while react-navigation's web
// linking keeps the current route in the address bar (file:///market/stock/JNJ
// ...). Nothing on disk backs those URLs, so any reload of the window — the
// View > Reload menu item, appRestart()'s browserWindow.reload(), the app-lock
// watchdog's location.reload() — fails with ERR_FILE_NOT_FOUND and leaves a
// blank window. `did-fail-load` is where that is turned back into the app
// shell.

const FILE_PROTOCOL_PREFIX = 'file://';
// A navigation that was superseded (or cancelled) reports ERR_ABORTED. Taking
// the window back to the shell there would fight the navigation that replaced
// it.
const ERR_ABORTED = -3;

function stripQueryAndHash(url: string): string {
  const cutIndex = url.search(/[?#]/);
  return cutIndex === -1 ? url : url.slice(0, cutIndex);
}

export function shouldReloadAppShellAfterFailedLoad(params: {
  validatedURL: string;
  isMainFrame: boolean;
  errorCode: number;
  appShellUrl: string;
}): boolean {
  const { validatedURL, isMainFrame, errorCode, appShellUrl } = params;
  // Sub-frames (the js-sdk iframe, dapp webviews) own their own content; a
  // failure there must never replace the whole window.
  if (!isMainFrame) {
    return false;
  }
  if (errorCode === ERR_ABORTED) {
    return false;
  }
  if (!validatedURL.startsWith(FILE_PROTOCOL_PREFIX)) {
    return false;
  }
  // The shell itself failing means the build is broken, so reloading it would
  // spin forever.
  if (stripQueryAndHash(validatedURL) === stripQueryAndHash(appShellUrl)) {
    return false;
  }
  return true;
}
