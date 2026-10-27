// Release builds read version values from a global defined by release-meta.js.
// Import this first in every privacy-chain Worker entry; development builds inline the values.
declare const __webpack_public_path__: string | undefined;

type IReleaseEnvScope = typeof globalThis & {
  __ONEKEY_RELEASE_ENV__?: Record<string, string | undefined>;
  importScripts?: (...urls: string[]) => void;
};

export function ensurePrivacyChainWorkerReleaseEnv(): void {
  const scope = globalThis as IReleaseEnvScope;
  if (
    !scope.__ONEKEY_RELEASE_ENV__ &&
    typeof scope.importScripts === 'function' &&
    typeof __webpack_public_path__ === 'string'
  ) {
    try {
      scope.importScripts(`${__webpack_public_path__}release-meta.js`);
    } catch {
      // Not emitted in development builds.
    }
  }
  scope.__ONEKEY_RELEASE_ENV__ = scope.__ONEKEY_RELEASE_ENV__ ?? {};
}

ensurePrivacyChainWorkerReleaseEnv();
