import posthog from 'posthog-js';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

const POSTHOG_API_KEY = 'phc_HxZGSxQodUZfWnQQWiGX0AjrMIOOIpp7oEwmKlkzhVg';

let initialized = false;

export function initPosthog({
  enableTestEndpoint,
}: {
  enableTestEndpoint?: boolean;
} = {}) {
  if (initialized) return;
  if (platformEnv.isDev || platformEnv.isE2E || enableTestEndpoint) return;

  initialized = true;
  posthog.init(POSTHOG_API_KEY, {
    api_host: 'https://onekey.so/ph',
    capture_pageview: 'history_change',
    autocapture: {
      css_selector_allowlist: ['a', 'button', '[role="button"]'],
      capture_copied_text: false,
    },
    cross_subdomain_cookie: true,
    persistence: 'localStorage+cookie',
    mask_all_text: true,
    mask_all_element_attributes: true,
    disable_session_recording: true,
    advanced_disable_flags: true,
    disable_surveys: true,
  });
}
