module.exports = {
  'manifest_version': 3,
  'version': process.env.VERSION,
  'name': 'OneKey wallet',
  'description': 'OneKey wallet', // process.env.npm_package_description,
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
        // allow site load iframe force service-worker update
        'ui-content-script-iframe.html',
      ],
      'matches': ['<all_urls>'],
    },
    {
      'resources': ['icon-128.png'],
      'matches': [],
    },
  ],
  'permissions': [
    // 'http://localhost:8545/',
    // 'https://*.infura.io/',
    // '*://*.onekey.so/',
    // '*://*.eth/',
    'storage',
    // 'unlimitedStorage',
    // 'clipboardWrite',
    // 'notifications',
    // 'activeTab',
    // 'webRequest',
  ],
};
