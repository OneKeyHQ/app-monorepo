/**
 * Custom transformer that uses react-native-svg-transformer for .svgx files
 * and the default transformer for all other files.
 *
 * This allows us to use SVG files as React Native components for tab icons
 * while keeping the default behavior for other files.
 */
const fs = require('fs');
const path = require('path');

const { parseSync } = require('@babel/core');
const upstreamTransformer = require('@expo/metro-config/babel-transformer');
const svgTransformer = require('react-native-svg-transformer');

const {
  getMobileLockdownPolyfills,
  isMobileLockdownEnabled,
} = require('./plugins/mobileLockdown');

module.exports.transform = async ({ src, filename, options }) => {
  if (
    isMobileLockdownEnabled() &&
    /[\\/](?:ses-hermes\.cjs|repair\.js)$/.test(filename) &&
    getMobileLockdownPolyfills()
      .map((polyfill) => fs.realpathSync(polyfill))
      .includes(fs.realpathSync(path.resolve(options.projectRoot, filename)))
  ) {
    // Expo parses ignored files again without a filename or config isolation.
    // Supply a parse-only AST for the exact vetted preludes so application
    // transforms and Babel helpers never run before Metro's require exists.
    return {
      ast: parseSync(src, {
        filename,
        sourceType: 'script',
        babelrc: false,
        configFile: false,
      }),
    };
  }
  if (filename.endsWith('.svgx')) {
    return svgTransformer.transform({ src, filename, options });
  }
  return upstreamTransformer.transform({ src, filename, options });
};
