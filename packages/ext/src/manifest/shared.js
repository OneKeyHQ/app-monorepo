module.exports = {
  'manifest_version': 3,
  'name': 'OneKey Wallet Ext 88365',
  'version': process.env.npm_package_version,
  'description': process.env.npm_package_description,
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
      'js': ['content-script.493df0b3.bundle.js'],
      'run_at': 'document_start', // MUST be document_start to inject ASAP
      'all_frames': true, // including iframe inject
    },
  ],
  'icons': {
    '34': 'icon-34.png',
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
      'resources': ['icon-128.png', 'icon-34.png'],
      'matches': [],
    },
  ],
  'permissions': [
    'http://localhost:8545/',
    'https://*.infura.io/',
    '*://*.onekey.so/',
    '*://*.eth/',
    'storage',
    'unlimitedStorage',
    'clipboardWrite',
    'activeTab',
    'webRequest',
    'notifications',
  ],
};
