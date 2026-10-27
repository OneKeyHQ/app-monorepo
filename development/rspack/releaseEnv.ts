// Values that change between releases but must not invalidate unchanged modules.
// Keep compile-time feature flags in DefinePlugin so dead code elimination works.
export const RELEASE_ENV_KEYS = [
  'VERSION',
  'BUNDLE_VERSION',
  'BUILD_NUMBER',
  'BUILD_TIME',
  'GITHUB_SHA',
  'WORKFLOW_GITHUB_SHA',
] as const;

export type ReleaseEnvKey = (typeof RELEASE_ENV_KEYS)[number];

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { resolveCommitSha } = require('../utils/resolveCommitSha') as {
  resolveCommitSha: () => string;
};

export function getReleaseEnvValue(key: ReleaseEnvKey): string | undefined {
  return key === 'GITHUB_SHA' ? resolveCommitSha() : process.env[key];
}

export function getReleaseEnvSource(): string {
  const values = Object.fromEntries(
    RELEASE_ENV_KEYS.map((key) => [key, getReleaseEnvValue(key)]),
  );
  return `globalThis.__ONEKEY_RELEASE_ENV__=${JSON.stringify(values)};`;
}
