import 'setimmediate';

import '@onekeyhq/shared/src/polyfills/globalShim';

const activeTimeAt = Date.now();
console.log('activeTimeAt', activeTimeAt);
const maxActiveTime = 5 * 60 * 1000;
const checkInterval = setInterval(() => {
  const currentTime = Date.now();
  if (currentTime - activeTimeAt >= maxActiveTime) {
    clearInterval(checkInterval);
    window.close();
  }
}, 10);

// Close the page after 5 minutes when the page is focused
window.addEventListener('focus', () => {
  const currentTime = Date.now();
  if (currentTime - activeTimeAt >= maxActiveTime) {
    window.close();
  }
});

// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
const uiJsBridge = require('../ui/uiJsBridge')
  .default as typeof import('../ui/uiJsBridge').default;

uiJsBridge.init();

const renderApp: typeof import('../ui/renderPassKeyPage').default =
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  require('../ui/renderPassKeyPage').default;

renderApp();
