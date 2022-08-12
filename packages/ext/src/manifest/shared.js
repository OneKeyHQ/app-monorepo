const isDev = process.env.NODE_ENV !== 'production';
// https://developer.chrome.com/docs/extensions/mv3/manifest/key/
const extensionIdKey = '';
module.exports = {
  // generate extensionId in local
  // 'key': process.env.NODE_ENV !== 'production' ? extensionIdKey : undefined,
  'version': process.env.VERSION,
  'name': 'OneKey',
  'description':
    'Multi-Chain Support for BTC, ETH, BNB, NEAR & other Layer2 Networks',
  /*
  'options_page': 'ui-options.html',
  'chrome_url_overrides': {
    'newtab': 'ui-newtab.html',
  },
  'devtools_page': 'ui-devtools.html',
  */

  // https://developer.chrome.com/docs/extensions/mv3/content_scripts/
  'content_scripts': [
    {
      'matches': ['http://*/*', 'https://*/*', '<all_urls>'],
      'js': ['content-script.bundle.js'],
      'run_at': 'document_start', // MUST be document_start to inject ASAP
      'all_frames': true, // including iframe inject
    },
  ],
  'icons': {
    '128': 'icon-128.png',
  },
  // https://developer.chrome.com/docs/extensions/mv3/manifest/web_accessible_resources/
  'web_accessible_resources': [
    {
      'resources': [
        // allow content-script inject js file
        'injected.js',
        ...(isDev
          ? [
              // allow site load iframe force service-worker update
              'ui-content-script-iframe.html',
            ]
          : []),
      ].filter(Boolean),
      'matches': ['<all_urls>'],
    },
    {
      'resources': ['icon-128.png'],
      'matches': [],
    },
  ],
  'permissions': [
    'https://dapp-server.onekey.so/*', // allow CORS requests in firefox
    // 'http://localhost:8545/',
    // 'https://*.infura.io/',
    // '*://*.onekey.so/',
    // '*://*.eth/',
    'storage',
    'unlimitedStorage',
    // 'clipboardWrite',
    // 'notifications',
    // 'activeTab',
    // 'webRequest',
  ],
};
