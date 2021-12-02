// @ts-nocheck
/* eslint-disable  */
console.log(
  `[OneKey RN] This is the background page. ${new Date().toLocaleTimeString()}`,
);
console.log('     Put the background scripts here. 啊啊啊111');

// navigator.serviceWorker.register('chrome-extension://nhccmkonbhjkihmkjcodcepopkjpldoa/js/background.bundle.js');

// disable service-worker cache after extension reload.
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// TODO debug env only
chrome.runtime.onMessage.addListener((message) => {
  if (message?.channel === 'EXTENSION_INTERNAL_CHANNEL') {
    if (message.method === 'reload') {
      chrome.runtime.reload();
      // chrome.tabs.create({url: 'ui-popup.html'});
    }
  }
});

// tsconfig.json isolatedModules: true
export {};
