import platformEnv from '../../platformEnv';

import type { IOnramperConfig } from './type';

// Kept apart from realClient.native.ts on purpose: the entry gate
// (canUseHeadless) only needs to know whether a credential pair exists, and
// that gate runs from Home startup code. Importing the real client there would
// drag the Onramper SDK into the main startup graph.

// Onramper credentials. BOTH are required by the SDK's configure() — apiKey is
// the publishable key (the hosted widget embeds the same key in its URL, it is
// not the backend partner secret), clientId identifies the partner app.
// Staging and production use DIFFERENT pairs, so the pair is selected with the
// same isDev switch as `environment` — a production build can never ship the
// staging key by accident.
const STAGING_CREDENTIALS = {
  clientId: '01KJD2DBBGF9Q8G133QK2A3DC1',
  apiKey: 'pk_test_01KWHMBRP4ABPB5DE4EB0CHNC6',
};
// Production pair is injected at bundle time (OK-59538 forbids committing it
// in plaintext): CI appends ONRAMPER_CLIENT_ID / ONRAMPER_API_KEY from GitHub
// secrets to .env.expo (release-ios.yml → shared-env action) before the EAS
// upload; local production-profile builds read them from the git-ignored root
// .env. Both names must stay in envExposedToClient.js for the babel inline to
// happen. When unset, hasOnramperCredentials() keeps production builds on the
// web widget instead of crashing at client creation.
const PRODUCTION_CREDENTIALS = {
  clientId: process.env.ONRAMPER_CLIENT_ID ?? '',
  apiKey: process.env.ONRAMPER_API_KEY ?? '',
};

function getCredentials() {
  return platformEnv.isDev ? STAGING_CREDENTIALS : PRODUCTION_CREDENTIALS;
}

export function hasOnramperCredentials(): boolean {
  const credentials = getCredentials();
  return Boolean(credentials.apiKey && credentials.clientId);
}

export function getOnramperConfig(): IOnramperConfig {
  return {
    ...getCredentials(),
    // The SDK only knows 'development' | 'production'; any other string is
    // silently coerced to production on the Swift side, so map dev builds to
    // 'development' explicitly (our staging session tokens only work there).
    environment: platformEnv.isDev ? 'development' : 'production',
    theme: 'system',
  };
}
