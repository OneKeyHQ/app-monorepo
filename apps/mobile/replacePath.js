const path = require('path');

const replacePath = (to, from = __dirname) =>
  to.replace(`${path.resolve(from, '../../')}/`, '');

exports.replacePath = replacePath;
