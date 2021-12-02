// TODO firefox, chrome, edge manifest.json

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
  */
  'devtools_page': 'ui-devtools.html',
  'action': {
    'default_popup': 'ui-popup.html',
    'default_icon': 'icon-34.png',
  },
  // https://developer.chrome.com/docs/extensions/mv3/migrating_to_service_workers/
  'background': {
    'service_worker': 'js/background.bundle.js',
  },
  // https://developer.chrome.com/docs/extensions/mv3/content_scripts/
  'content_scripts': [
    {
      'matches': ['http://*/*', 'https://*/*', '<all_urls>'],
      'js': ['js/content-script.bundle.js'],
      'run_at': 'document_start',
      'all_frames': true,
    },
  ],
  'icons': {
    '128': 'icon-128.png',
  },
  'web_accessible_resources': [
    {
      'resources': [
        // allow content-script inject js file
        'injected.js',
        // allow site load iframe force service-worker update
        // TODO DEV only
        'ui-popup.html',
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
