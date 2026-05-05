const keylessWebTabUrlPatternsConfig = require('./keylessWebTabUrlPatternsJson.json');

const KEYLESS_WEB_TAB_URL_PATTERNS = [
  ...keylessWebTabUrlPatternsConfig.basePatterns,
  ...(process.env.NODE_ENV !== 'production'
    ? keylessWebTabUrlPatternsConfig.localDevPatterns
    : []),
];

module.exports = {
  KEYLESS_WEB_TAB_URL_PATTERNS,
};
