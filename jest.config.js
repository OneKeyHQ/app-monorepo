// https://jestjs.io/docs/configuration
const { defaults } = require('jest-config');

module.exports = {
  verbose: true,
  moduleFileExtensions: [...defaults.moduleFileExtensions, 'd.ts', 'ts', 'tsx'],
};
