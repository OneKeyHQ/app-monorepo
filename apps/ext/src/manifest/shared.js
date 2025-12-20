/* eslint-disable spellcheck/spell-checker */
const isDev = process.env.NODE_ENV !== 'production';
// https://developer.chrome.com/docs/extensions/mv3/manifest/key/
// The `key` field is used by Chromium to generate a stable extension ID for
// unpacked/side-loaded extensions (useful for OAuth redirect URLs, native
// messaging host allow-lists, etc.). It is ignored by Chrome Web Store builds.
//
// Keep it DEV-only and read from env so we don't hardcode a team-wide ID.
const devExtensionIdKey =
  // DEV extensionId:   goodgebcoklfekldbhjmckehehjdfipe
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArQxWBwYxmyGIm461gHgZKcoiu9uzjxBvnIkzIsv5woytRUbDt3ZyF1wnSceoSxcLiTN3q/Ml0X/EAIjV+eLzzKbeYsbmYNbTcdq71I6vxIQ4X4YbafVx8bURz13hFYl8YxFVNlNP2GxcNATNeF3CIMDL+VhYBV/eJ6Oaj1YbZhDESyYPBDtNjyT3wc7eD4kE9ICEX3EC/cksRbuZ80/Rzsyn66hH+EJxfcJT9sO4f2ol6PvBDurDcEUB3fIt1NglCPBF8Kn5NRLhsr+c8r0bBvAObyVu5oow73iaAi8BS4nMmaBybc9Ec/n6A3U7DfOL1p7zE66X7lRRNcfr6lHTvQIDAQAB';

// TODO:
// Required value 'version' is missing or invalid. It must be between 1-4 dot-separated integers each between 0 and 65536.
// beta version cannot be work in chrome store.

const version = process.env.VERSION;

module.exports = {
  // generate extensionId in local
  'key': devExtensionIdKey,
  version,
  'name': 'OneKey: Secure Crypto Wallet',
  'description':
    'Anti-scam crypto wallet for every chain. Supports major blockchains like Bitcoin, Ethereum, Solana, Tron and more.',
  /*
  'options_page': 'ui-options.html',
  'chrome_url_overrides': {
    'newtab': 'ui-newtab.html',
  },
  'devtools_page': 'ui-devtools.html',
  */

  'icons': {
    '128': 'icon-128.png',
  },
  // https://developer.chrome.com/docs/extensions/mv3/manifest/web_accessible_resources/
  'web_accessible_resources': [
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
      ].filter(Boolean),
      'matches': ['<all_urls>'],
    },
    {
      'resources': ['icon-128.png'],
      'matches': [],
    },
  ],
};
