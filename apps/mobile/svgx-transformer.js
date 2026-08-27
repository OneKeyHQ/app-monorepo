/**
 * Custom transformer that uses react-native-svg-transformer for .svgx files
 * and the default transformer for all other files.
 *
 * This allows us to use SVG files as React Native components for tab icons
 * while keeping the default behavior for other files.
 */
// This is an Expo project, so the upstream transformer has to be Expo's own.
// React Native's resolves the Babel config differently and, from SDK 56, fails
// with "Cannot find module 'babel.config.js'" inside the transform worker.
const upstreamTransformer = require('@expo/metro-config/babel-transformer');
const svgTransformer = require('react-native-svg-transformer');

module.exports.transform = async ({ src, filename, options }) => {
  if (filename.endsWith('.svgx')) {
    return svgTransformer.transform({ src, filename, options });
  }
  return upstreamTransformer.transform({ src, filename, options });
};
