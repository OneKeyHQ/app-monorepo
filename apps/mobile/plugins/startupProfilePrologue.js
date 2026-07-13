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
  // The __d wrapper intercepts every `__d(factory, moduleId, deps)` call and
  // replaces `factory` with a timed wrapper. Because this prologue is emitted
  // into preSection (BEFORE any __d call), every module factory — including
  // those in the common/main eager bundles — goes through the wrapper.
  //
  // Why __d and not __r: Metro's metroRequire passes a closure-captured
  // reference to itself as the factory's `require` parameter. Reassigning
  // `globalThis.__r` after the prelude runs doesn't affect that internal
  // reference, so a __r wrapper is invisible to factory-internal `require()`
  // calls. Wrapping at __d time replaces the stored factory itself, so when
  // metroRequire later calls `modules[id].factory(...)`, it runs our wrapper.
  //
  // The stats Map is stored on __ONEKEY_STARTUP_PROFILE_STATS__. The
  // TS-side `installStartupProfileJs` sees it's already populated and
  // skips its own (broken) __r wrapping. `flushStartupProfileJs` reads
  // from the same global key and emits the results.
  const defineWrapper = `
(function(){
  var _origD = globalThis.__d;
  if (typeof _origD !== 'function') return;
  var _stats = new Map();
  var _childMs = [];
  globalThis.__ONEKEY_STARTUP_PROFILE_STATS__ = _stats;
  globalThis.__d = function(_factory, _moduleId, _deps) {
    var _wrapped = function() {
      var _s = Date.now();
      _childMs.push(0);
      try { return _factory.apply(this, arguments); }
      finally {
        var _t = Date.now() - _s;
        var _c = _childMs.pop() || 0;
        var _self = _t - _c; if (_self < 0) _self = 0;
        if (_childMs.length > 0) _childMs[_childMs.length - 1] += _t;
        if (_t >= 1) _stats.set(_moduleId, {id: _moduleId, selfMs: _self, totalMs: _t});
      }
    };
    return _origD(_wrapped, _moduleId, _deps);
  };
})();`.trim();

  return [
    '// --- ONEKEY_STARTUP_PROFILE prologue ---',
    `globalThis.${GLOBAL_FLAG_KEY} = true;`,
    `globalThis.${GLOBAL_ID_TO_PATH_KEY} = ${mapJson};`,
    defineWrapper,
  ].join('\n');
}

module.exports = {
  buildStartupProfilePrologue,
  isStartupProfileEnabled,
  GLOBAL_FLAG_KEY,
  GLOBAL_ID_TO_PATH_KEY,
  _internal: { trimMonorepoPrefix },
};
