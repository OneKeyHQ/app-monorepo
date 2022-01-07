// UI:
// navigator.serviceWorker.register('chrome-extension://{chrome.runtime.id}/js/background.bundle.js');
// navigator.serviceWorker.getRegistration().then( sw => sw.update() )

// BG:
// disable service-worker cache after extension reload.
function disableCacheInBackground() {
  // TODO check only service-worker background only (manifest v3)
  // eslint-disable-next-line no-restricted-globals
  self.addEventListener('install', () => {
    // @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call,no-restricted-globals
    self.skipWaiting();
  });
}

export default {
  disableCacheInBackground,
};
