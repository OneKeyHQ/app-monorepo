const isDev = process.env.NODE_ENV !== 'production';

const {
  XMR_BUILT_IN_NODE_URLS,
} = require('../../../../packages/shared/src/config/xmrNodeConstants');
const {
  KEYLESS_WEB_TAB_URL_PATTERNS,
} = require('../../../../packages/shared/src/keylessWallet/keylessWebTabUrlPatterns');
const excludeMatches = require('../content-script/excludeMatches');

const common = require('./common');

// Derived rather than written twice: the pattern and the URL the wallet
// actually dials must not be able to drift apart.
const XMR_BUILT_IN_NODE_ORIGIN_PATTERN = `${
  new URL(XMR_BUILT_IN_NODE_URLS[0]).origin
}/*`;

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
      '48': 'icon-48.png',
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
  'side_panel': {
    'default_path': 'ui-side-panel.html',
  },
  'permissions': [
    'offscreen',
    // 'https://dapp-server.onekey.so/*', // allow CORS requests in firefox
    // 'http://localhost:8545/',
    // 'https://*.infura.io/',
    // '*://*.onekeycn.com/*',
    // '*://*.onekeytest.com/*',
    // '*://*.eth/',
    'identity',
    'activeTab',
    'storage',
    'unlimitedStorage',
    // 'system.storage',
    'notifications',
    'idle',
    'sidePanel',
    'contextMenus',
  ],
  'host_permissions': [
    ...KEYLESS_WEB_TAB_URL_PATTERNS,
    // The privacy chains scan from a node the user picks. The runtime is wasm
    // in the offscreen document, so its own fetch obeys CORS -- and a Monero
    // node sends no CORS headers unless someone proxied it, which left exactly
    // one of twelve public nodes reachable. The background relays those
    // requests instead, and needs permission for the node this build ships.
    XMR_BUILT_IN_NODE_ORIGIN_PATTERN,
  ],
  // Any other node the user chooses is asked for at the moment they choose it.
  //
  // Requested at runtime rather than up front on purpose: `<all_urls>` in
  // `host_permissions` reads to a reviewer (and to the user at install) as
  // "this wallet wants to read every site", which is not what it does. Asking
  // when the user adds a node ties the prompt to the reason for it.
  'optional_host_permissions': ['http://*/*', 'https://*/*'],
};
