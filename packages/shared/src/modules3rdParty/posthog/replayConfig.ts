import type { IReplayPlatform, IReplayProjectConfig } from './replayTypes';

// Buckets out of 10000 per platform (300 = 3%). Production ships at 0 and is
// raised by hot update only after the test-project verification passes.
export const REPLAY_SAMPLE_THRESHOLDS: Record<IReplayPlatform, number> = {
  ios: 0,
  android: 0,
  desktop: 0,
};

// v1 uploads to PostHog EU directly. Replace with the OneKey utility proxy
// (/utility/v1/track/rp) once it is deployed.
export const REPLAY_INGEST_HOST = 'https://eu.i.posthog.com';

export function getReplayProjectConfig(
  enableTestEndpoint: boolean,
): IReplayProjectConfig {
  // Public project tokens (phc_...) inlined at build time; unset disables
  // replay for that environment.
  const token = enableTestEndpoint
    ? process.env.POSTHOG_REPLAY_TOKEN_TEST
    : process.env.POSTHOG_REPLAY_TOKEN_PROD;
  return {
    token: token ? token : undefined,
    host: REPLAY_INGEST_HOST,
  };
}
