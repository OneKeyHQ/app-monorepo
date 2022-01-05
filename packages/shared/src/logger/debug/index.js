const setup = require('./common');
const browser = require('./browser');

async function createDebug() {
  return setup(browser);
}

module.exports = createDebug;
