// TODO firefox, chrome, edge manifest.json

module.exports = {
  'manifest_version': 3,
  'name': 'OneKey Wallet Ext 88365',
  'version': process.env.npm_package_version,
  'description': process.env.npm_package_description,
  /*
  'options_page': 'ui-options.html',
  'devtools_page': 'ui-devtools.html',
  'chrome_url_overrides': {
    'newtab': 'ui-newtab.html',
  },
  */
  'action': {
    'default_popup': 'ui-popup.html',
    'default_icon': 'icon-34.png',
  },
  'background': { 'service_worker': 'js/background.bundle.js' },
  'content_scripts': [
    {
      'matches': ['http://*/*', 'https://*/*', '<all_urls>'],
      'js': ['js/content-script.bundle.js'],
    },
  ],
  'icons': {
    '128': 'icon-128.png',
  },
  'web_accessible_resources': [
    {
      'resources': ['icon-128.png', 'icon-34.png'],
      'matches': [],
    },
  ],
};
