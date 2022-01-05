module.exports = {
  'commands': {
    '_execute_browser_action': {
      'suggested_key': {
        'windows': 'Alt+Shift+M',
        'mac': 'Alt+Shift+M',
        'chromeos': 'Alt+Shift+M',
        'linux': 'Alt+Shift+M',
      },
    },
  },
  'author': 'https://www.onekey.so',
  // 'default_locale': 'en', // enable this after locale file exists
  'content_security_policy':
    "script-src 'self' https://www.google-analytics.com https://www.googletagmanager.com; object-src 'self'",

  //----------------------------------------------

  'manifest_version': 2,
  'browser_action': {
    'default_icon': {
      '34': 'icon-34.png',
      '128': 'icon-128.png',
    },
    'default_title': 'OneKey',
    'default_popup': 'ui-popup.html',
  },
  'background': {
    'page': 'background.html',
    'persistent': true,
  },
  'web_accessible_resources': [
    'inpage.js',
    'phishing.html',
    'phishing_en.html',
  ],
};
/*
action:{
      "default_title": "OneKey",

 */
