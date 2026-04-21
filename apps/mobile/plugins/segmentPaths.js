/**
 * Shared segment directory paths used by both the serializer and build-bundle.js.
 * Changing these in one place keeps both in sync (#29).
 *
 * Per-target isolation (#51): main and background get separate output dirs
 * to prevent segment file collisions.
 */
const path = require('path');

const mobileDirPath = path.resolve(__dirname, '..');

function getSegmentsDir(runtimeTarget) {
  const suffix = runtimeTarget === 'background' ? '-background' : '';
  return path.resolve(mobileDirPath, `dist/segments${suffix}`);
}

function getManifestPath(runtimeTarget) {
  const suffix = runtimeTarget === 'background' ? '-background' : '';
  return path.resolve(mobileDirPath, `dist/segment-manifest${suffix}.json`);
}

// Per-runtime intermediate map written by segmentSerializer when the union
// build is not in use (legacy two-step path). The union build emits a single
// merged map directly via getMergedModuleIdMapPath().
function getModuleIdMapPath(runtimeTarget) {
  const suffix = runtimeTarget === 'background' ? '-background' : '-main';
  return path.resolve(mobileDirPath, `dist/module-id-map${suffix}.json`);
}

// Merged module-id map shipped with the APK / .app bundle so post-mortem
// crash analysis can resolve a numeric moduleId back to its source file
// without needing the original JS bundles.
function getMergedModuleIdMapPath() {
  return path.resolve(mobileDirPath, 'dist/module-id-map.json');
}

// Default paths (main runtime) for backward compatibility
const SEGMENTS_INPUT_DIR = getSegmentsDir('main');
const SEGMENT_MANIFEST_PATH = getManifestPath('main');

module.exports = {
  SEGMENTS_INPUT_DIR,
  SEGMENT_MANIFEST_PATH,
  getSegmentsDir,
  getManifestPath,
  getModuleIdMapPath,
  getMergedModuleIdMapPath,
};
