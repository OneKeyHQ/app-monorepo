// https://jestjs.io/docs/configuration
const { defaults } = require('jest-config');

module.exports = {
  preset: 'react-native',
  verbose: true,
  moduleFileExtensions: [...defaults.moduleFileExtensions, 'd.ts', 'ts', 'tsx'],
};
