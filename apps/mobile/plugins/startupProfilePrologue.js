/**
 * Shared helper that builds the `ONEKEY_STARTUP_PROFILE` prologue.
 *
 * Two call sites consume this:
 *   - apps/mobile/plugins/index.js (default Metro path — dev, non-union-build
 *     production) prepends the string to the main entry module's emitted code.
 *   - apps/mobile/scripts/unionBuild.js (gradle-invoked union build) prepends
 *     the string to the common bundle's `preSection` so both main and
 *     background Hermes runtimes see the global flag before any `__d` runs.
 *
 * Keeping both call sites on the same helper prevents drift — the bug this
 * module was created to fix was unionBuild.js silently lacking the
 * injection that plugins/index.js already had.
 */

const GLOBAL_FLAG_KEY = '__ONEKEY_STARTUP_PROFILE__';
const GLOBAL_ID_TO_PATH_KEY = '__ONEKEY_MODULE_ID_TO_PATH__';

function isStartupProfileEnabled(env) {
  const e = env || process.env;
  return (
    e.ONEKEY_STARTUP_PROFILE === '1' || e.ONEKEY_STARTUP_PROFILE === 'true'
  );
}

function trimMonorepoPrefix(filePath) {
  return filePath
    .replace(/^.*\/node_modules\//, 'node_modules/')
    .replace(/^.*\/packages\//, 'packages/')
    .replace(/^.*\/apps\//, 'apps/');
}

/**
 * Returns the prologue string, or '' when `ONEKEY_STARTUP_PROFILE` is not set.
 * Callers should treat '' as "skip injection".
 *
 * @param {{ fileToIdMap?: { entries?: () => Iterable<[string, number]> },
 *           env?: Record<string, string> }} [opts]
 */
function buildStartupProfilePrologue(opts) {
  const { fileToIdMap, env } = opts || {};
  if (!isStartupProfileEnabled(env)) return '';

  const idToPath = {};
  const entries =
    fileToIdMap && typeof fileToIdMap.entries === 'function'
      ? fileToIdMap.entries()
      : null;
  if (entries) {
    for (const [filePath, id] of entries) {
      if (typeof id === 'number' && typeof filePath === 'string') {
        idToPath[id] = trimMonorepoPrefix(filePath);
      }
    }
  }
  const mapJson = JSON.stringify(idToPath);
  return [
    '// --- ONEKEY_STARTUP_PROFILE prologue ---',
    `globalThis.${GLOBAL_FLAG_KEY} = true;`,
    `globalThis.${GLOBAL_ID_TO_PATH_KEY} = ${mapJson};`,
  ].join('\n');
}

module.exports = {
  buildStartupProfilePrologue,
  isStartupProfileEnabled,
  GLOBAL_FLAG_KEY,
  GLOBAL_ID_TO_PATH_KEY,
  _internal: { trimMonorepoPrefix },
};
