// Release builds read version values from a global that release-meta.js
// defines (pages load it; see development/rspack/releaseEnv.ts). Import this
// first in every privacy-chain Worker entry: a Blob Worker gets the page's
// values from inlineWorkerRuntime, a URL Worker loads release-meta.js itself.
// Development builds inline those values and emit no release-meta.js.
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
