const lodash = require('lodash');
const chromeConfig = require('./chrome');

module.exports = lodash.merge({}, chromeConfig, {
  // overwrite here
});
