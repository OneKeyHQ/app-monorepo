// UI:
// navigator.serviceWorker.register('chrome-extension://{chrome.runtime.id}/js/background.bundle.js');
// navigator.serviceWorker.getRegistration().then( sw => sw.update() )

// BG:
// disable service-worker cache after extension reload.
import platformEnv from '@onekeyhq/shared/src/platformEnv';

function disableCacheInBackground() {
  // only service-worker background only (manifest v3)
  if (platformEnv.isExtensionBackgroundServiceWorker) {
    // eslint-disable-next-line no-restricted-globals
    self.addEventListener('install', () => {
      // @ts-expect-error
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call,no-restricted-globals
      self.skipWaiting();
    });
  }
}

if (process.env.NODE_ENV !== 'Production') {
  new WebSocket('ws://localhost:23121').onmessage = (event) => {
    console.log('event.data', event.data);
    if (event.data === 'update') {
      chrome.tabs.query({ active: true }).then(() => {
        chrome.runtime.reload()
        chrome.tabs.reload()
      })
    }
  };
}

export default {
  disableCacheInBackground,
};
