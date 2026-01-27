/**
 * Custom transformer that uses react-native-svg-transformer for .svgx files
 * and the default transformer for all other files.
 *
 * This allows us to use SVG files as React Native components for tab icons
 * while keeping the default behavior for other files.
 */
const svgTransformer = require('react-native-svg-transformer');
const upstreamTransformer = require('@react-native/metro-babel-transformer');

module.exports.transform = async ({ src, filename, options }) => {
  if (filename.endsWith('.svgx')) {
    return svgTransformer.transform({ src, filename, options });
  }
  return upstreamTransformer.transform({ src, filename, options });
};
