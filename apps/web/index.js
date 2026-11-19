import '@onekeyhq/shared/src/polyfills';

import { getKeylessEntry } from './src/keylessDeletion/entry';
import { messages } from './src/keylessDeletion/messages';

function showKeylessLoadError(root) {
  const notice = globalThis.document.createElement('p');
  notice.role = 'alert';
  notice.textContent = messages.linkLoadFailed;
  const retry = globalThis.document.createElement('button');
  retry.type = 'button';
  retry.textContent = messages.startupRetry;
  retry.onclick = () => globalThis.location.reload();
  root.replaceChildren(notice, retry);
  void import('./src/keylessDeletion/localePreference')
    .then(({ loadStartupRetryLabel }) => loadStartupRetryLabel())
    .then((label) => {
      if (label) retry.textContent = label;
    })
    .catch(() => {
      // Keep the retry action available when translation resources fail to load.
    });
}

const keylessEntry = getKeylessEntry(new URL(globalThis.location.href));
if (!keylessEntry) {
  void import(/* webpackMode: "eager" */ './startWalletApp');
} else {
  const root = globalThis.document.getElementById('root');
  if (keylessEntry.kind === 'callback') {
    root.textContent = messages.callback;
  } else {
    const referrer = globalThis.document.createElement('meta');
    referrer.name = 'referrer';
    referrer.content = 'no-referrer';
    globalThis.document.head.append(referrer);
    globalThis.document
      .querySelector('meta[name="viewport"]')
      ?.setAttribute(
        'content',
        'width=device-width, initial-scale=1, viewport-fit=cover',
      );
    void import('./src/keylessDeletion/mountAppRoute')
      .then(({ mount }) => mount(root))
      .catch(() => showKeylessLoadError(root));
  }
}
