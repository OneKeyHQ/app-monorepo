const isDev = process.env.NODE_ENV !== 'production';

const excludeMatches = require('../content-script/excludeMatches');
const common = require('./common');

module.exports = {
  'manifest_version': 3,
  // MAIN world injecting required version 111 or above
  'minimum_chrome_version': '111',
  //----------------------------------------------

  'commands': {
    '_execute_action': {
      'suggested_key': {
        'default': 'Alt+Shift+O',
        'mac': 'Alt+Shift+O',
        'windows': 'Alt+Shift+O',
        'chromeos': 'Alt+Shift+O',
        'linux': 'Alt+Shift+O',
      },
    },
  },
  'author': 'https://www.onekey.so',
  // 'default_locale': 'en', // enable this after locale file exists

  //----------------------------------------------

  // browser_action
  'action': {
    'default_icon': {
      '128': 'icon-128.png',
    },
    'default_title': 'OneKey',
    // open popup.html instantly, but display white screen when redirecting
    // 'default_popup': 'ui-popup-boot.html',
    'default_popup': 'ui-popup.html',
  },
  // https://developer.chrome.com/docs/extensions/mv3/migrating_to_service_workers/
  'background': {
    // TODO move js file to root, as some browsers will not working
    'service_worker': 'background.bundle.js',
    // The "background.persistent" key cannot be used with manifest_version 3. Use the "background.service_worker" key instead.
    // 'persistent': true,
  },
  // Not allowed for manifest V3: Invalid value for 'content_security_policy'.
  // 'content_security_policy': "script-src 'self'; object-src 'self';",
  /*
  Uncaught (in promise) RuntimeError: Aborted(CompileError: WebAssembly.instantiate(): Refused to compile or instantiate WebAssembly module because neither 'wasm-eval' nor 'unsafe-eval' is an allowed source of script in the following Content Security Policy directive: "script-src 'self'"). Build with -s ASSERTIONS=1 for more info.
   */
  'content_security_policy': {
    // "extension_pages": "script-src 'self'; object-src 'self'",
    // "sandbox_pages": "script-src 'self'; object-src 'self'",
    // "web_accessible_resources": "script-src 'self'; object-src 'self'",
    'extension_pages': common.content_security_policy,
  },
  'web_accessible_resources': [
    {
      'resources': ['icon-128.png'],
      'matches': [],
    },
    {
      'resources': ['icon-128-disable.png'],
      'matches': [],
    },
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
      ],
      'matches': ['<all_urls>'],
    },
  ].filter(Boolean),

  // https://developer.chrome.com/docs/extensions/mv3/content_scripts/
  'content_scripts': [
    {
      'matches': ['http://*/*', 'https://*/*', '<all_urls>'],
      'exclude_matches': excludeMatches,
      'js': ['content-script.bundle.js'],
      'run_at': 'document_start', // MUST be document_start to inject ASAP
      'all_frames': true, // including iframe inject
      'injectImmediate': true,
      'injectInto': 'content',
    },
    process.env.EXT_INJECT_MODE !== 'fileScript'
      ? {
          'world': 'MAIN',
          'matches': ['http://*/*', 'https://*/*', '<all_urls>'],
          'exclude_matches': excludeMatches,
          'js': ['injected.js'],
          'run_at': 'document_start',
          'all_frames': true, // including iframe inject
        }
      : null,
  ].filter(Boolean),

  'permissions': [
    'offscreen',
    // 'https://dapp-server.onekey.so/*', // allow CORS requests in firefox
    // 'http://localhost:8545/',
    // 'https://*.infura.io/',
    // '*://*.onekeycn.com/*',
    // '*://*.onekeytest.com/*',
    // '*://*.eth/',
    'tabs',
    'storage',
    'unlimitedStorage',
    'webRequest',
    // 'webRequestBlocking' requires manifest version of 2 or lower.
    // 'webRequestBlocking',
    // 'clipboardWrite',
    'notifications',
    // 'activeTab',
    // 'webRequest',
    'idle',
    'sidePanel',
  ],
};
