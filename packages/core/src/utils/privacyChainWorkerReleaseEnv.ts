// Release builds read version values from a global that release-meta.js sets
// in pages; a Worker never loads it, so define it before anything reads it.
// Import this first in every privacy-chain Worker entry.
export function ensurePrivacyChainWorkerReleaseEnv(): void {
  const scope = globalThis as typeof globalThis & {
    __ONEKEY_RELEASE_ENV__?: Record<string, string | undefined>;
  };
  scope.__ONEKEY_RELEASE_ENV__ = scope.__ONEKEY_RELEASE_ENV__ ?? {};
}

ensurePrivacyChainWorkerReleaseEnv();
