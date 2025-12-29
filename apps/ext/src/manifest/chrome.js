const isDev = process.env.NODE_ENV !== 'production';
const common = require('./common');

module.exports = {
  'manifest_version': 2,

  //----------------------------------------------

  'commands': {
    '_execute_browser_action': {
      'suggested_key': {
        'windows': 'Alt+Shift+O',
        'mac': 'Alt+Shift+O',
        'chromeos': 'Alt+Shift+O',
        'linux': 'Alt+Shift+O',
      },
    },
  },
  'author': 'https://www.onekey.so',
  // 'default_locale': 'en', // enable this after locale file exists

  'content_security_policy': common.content_security_policy,

  //----------------------------------------------

  'browser_action': {
    'default_icon': {
      '128': 'icon-128.png',
    },
    'default_title': 'OneKey',
    // 'default_popup': 'ui-popup-boot.html',
    'default_popup': 'ui-popup.html',
  },
  'background': {
    'page': 'background.html',
    'persistent': true,
  },
  'web_accessible_resources': [
    // allow content-script inject js file
    'injected.js',
    'icon-128-disable.png',
    ...(isDev
      ? [
          // allow site load iframe force service-worker update
          'ui-content-script-iframe.html',
        ]
      : []),
  ].filter(Boolean),

  'content_scripts': [
    {
      'matches': ['http://*/*', 'https://*/*', '<all_urls>'],
      'js': ['content-script.bundle.js'],
      'run_at': 'document_start', // MUST be document_start to inject ASAP
      'all_frames': true, // including iframe inject
    },
  ],

  'permissions': [
    'https://dapp-server.onekey.so/*', // allow CORS requests in firefox
    // 'http://localhost:8545/',
    // 'https://*.infura.io/',
    '*://*.onekeycn.com/*',
    '*://*.onekeytest.com/*',
    // '*://*.eth/',
    'storage',
    'unlimitedStorage',
    'webRequest',
    'webRequestBlocking',
    // 'clipboardWrite',
    'notifications',
    // 'activeTab',
    // 'webRequest',
    'idle',
  ],
};
/*
action:{
      "default_title": "OneKey",

 */
