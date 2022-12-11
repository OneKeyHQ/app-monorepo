module.exports = {
  'manifest_version': 3,
  //----------------------------------------------

  // browser_action
  'action': {
    'default_icon': 'icon-128.png',
    'default_title': 'OneKey',
    // open popup.html instantly, but display white screen when redirecting
    // 'default_popup': 'ui-popup-boot.html',
    'default_popup': 'ui-popup.html',
  },
  // https://developer.chrome.com/docs/extensions/mv3/migrating_to_service_workers/
  'background': {
    // TODO move js file to root, as some browsers will not working
    'service_worker': 'background.bundle.js',
  },
  // Not allowed for manifest V3: Invalid value for 'content_security_policy'.
  // 'content_security_policy': "script-src 'self'; object-src 'self';",
};
