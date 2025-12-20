const path = require('path');

const getPath = (...paths) => path.join(__dirname, '..', ...paths);

module.exports = {
  getPath,
};
