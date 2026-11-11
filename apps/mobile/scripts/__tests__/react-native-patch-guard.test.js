const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../../../..');
const patchesDir = path.join(repoRoot, 'patches');
const reactNativeRoot = path.join(repoRoot, 'node_modules/react-native');
const RCT_NETWORKING_PROVIDER_PATH =
  'Libraries/AppDelegate/RCTAppSetupUtils.mm';
const GUARD_PATTERN =
  /if \(blobModuleHandler == nil\) \{\s*return @\[\];\s*\}/u;
// The pre-patch literal: a nil `[moduleRegistry moduleForName:"BlobModule"]`
// lookup as the 4th element aborts the app with
// "attempt to insert nil object from objects[3]" (OK-66758).
const UNGUARDED_LITERAL_PATTERN =
  /return \[@\[(?:(?!\] arrayByAddingObjectsFromArray:)[\s\S])*?\[moduleRegistry moduleForName:"BlobModule"\],?[\s\S]*?\] arrayByAddingObjectsFromArray:/u;

function getInstalledReactNativeVersion() {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(reactNativeRoot, 'package.json'), 'utf8'),
  );
  return packageJson.version;
}

function parsePatchVersion(filename) {
  const match =
    /^react-native\+(?<version>\d+\.\d+\.\d+(?:-[^+]+)?)(?:\+\d+\+[^/]+)?\.patch$/u.exec(
      filename,
    );
  return match?.groups?.version ?? null;
}

function readReactNativePatches() {
  const installedVersion = getInstalledReactNativeVersion();
  return fs
    .readdirSync(patchesDir)
    .filter((filename) => parsePatchVersion(filename) === installedVersion)
    .map((filename) =>
      fs.readFileSync(path.join(patchesDir, filename), 'utf8'),
    );
}

// Only lines the patch adds; diff metadata, removed lines and hunk headers are dropped.
function extractAddedLines(patchContent) {
  return patchContent
    .split('\n')
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
    .map((line) => line.slice(1))
    .join('\n');
}

function stripLineComments(source) {
  return source.replace(/^\s*\/\/.*$/gmu, '');
}

describe('react-native RCTNetworking handler guard (OK-66758)', () => {
  it('keeps a react-native patch for the installed version', () => {
    expect(readReactNativePatches().length).toBeGreaterThan(0);
  });

  it('never inserts a nil module lookup into the networking handler literal', () => {
    const patchedSources = readReactNativePatches()
      .map(extractAddedLines)
      .join('\n');
    expect(patchedSources).toMatch(GUARD_PATTERN);
    expect(stripLineComments(patchedSources)).not.toMatch(
      UNGUARDED_LITERAL_PATTERN,
    );
  });

  it('keeps the guard in the installed react-native source', () => {
    const providerPath = path.join(
      reactNativeRoot,
      RCT_NETWORKING_PROVIDER_PATH,
    );
    if (!fs.existsSync(providerPath)) {
      // `node_modules` is not installed; the patch-content check above still runs.
      return;
    }
    const providerSource = stripLineComments(
      fs.readFileSync(providerPath, 'utf8'),
    );
    expect(providerSource).toMatch(GUARD_PATTERN);
    expect(providerSource).not.toMatch(UNGUARDED_LITERAL_PATTERN);
  });
});
