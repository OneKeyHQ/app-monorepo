/**
 * Shared segment directory paths used by both the serializer and build-bundle.js.
 * Changing these in one place keeps both in sync (#29).
 */
const path = require('path');

const mobileDirPath = path.resolve(__dirname, '..');

const SEGMENTS_INPUT_DIR = path.resolve(mobileDirPath, 'dist/segments');
const SEGMENT_MANIFEST_PATH = path.resolve(mobileDirPath, 'dist/segment-manifest.json');

module.exports = { SEGMENTS_INPUT_DIR, SEGMENT_MANIFEST_PATH };
