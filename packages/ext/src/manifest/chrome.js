const isDev = process.env.NODE_ENV !== 'production';
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
  'content_security_policy': `
script-src 'self' 'wasm-unsafe-eval';
object-src 'self';
`
    .split('\n')
    .join(''),

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
};
/*
action:{
      "default_title": "OneKey",

 */
