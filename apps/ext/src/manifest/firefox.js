const chromeManifestV3 = require('./chrome_v3');

module.exports = {
  ...chromeManifestV3,
  // Firefox hosts SDKs and Workers in a DOM event page, not an offscreen document.
  background: { page: 'background.html' },
  browser_specific_settings: {
    gecko: { id: 'firefox@onekey.so', strict_min_version: '128.0' },
  },
  content_scripts: chromeManifestV3.content_scripts.map((contentScript) => {
    const script = { ...contentScript };
    delete script.injectImmediate;
    delete script.injectInto;
    if (!script.exclude_matches?.length) delete script.exclude_matches;
    return script;
  }),
  web_accessible_resources: [
    {
      resources: ['injected.js', 'icon-128.png', 'icon-128-disable.png'],
      matches: ['<all_urls>'],
    },
  ],
  permissions: chromeManifestV3.permissions.filter(
    (permission) => !['offscreen', 'sidePanel'].includes(permission),
  ),
};

delete module.exports.minimum_chrome_version;
delete module.exports.side_panel;
