import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { BRAND_FONT_SOURCE } from './brandFont';

let reported = false;

// Release pipelines set ONEKEY_REQUIRE_PRIVATE_FONTS, so a production build
// running the open-source fallback means a release path skipped the gate.
// Report once instead of blocking the user. Sentry is loaded lazily so this
// check does not pull it into the desktop renderer startup graph.
export function reportBrandFontFallback() {
  if (
    reported ||
    !platformEnv.isProduction ||
    platformEnv.isE2E ||
    BRAND_FONT_SOURCE === 'private'
  ) {
    return;
  }
  reported = true;
  void import('@onekeyhq/shared/src/modules3rdParty/sentry').then(
    ({ captureException }) => {
      captureException(
        new Error(
          `Brand font fallback in production build: source=${BRAND_FONT_SOURCE}`,
        ),
      );
    },
  );
}
