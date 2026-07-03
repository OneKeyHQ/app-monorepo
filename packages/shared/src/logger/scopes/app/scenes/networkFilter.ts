import { ANALYTICS_EVENT_PATH } from '@onekeyhq/shared/src/analytics';
import { SENTRY_IPC } from '@onekeyhq/shared/src/modules3rdParty/sentry/basicOptions';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const isEnableLogNetwork = (path = '') =>
  !(
    path.includes(ANALYTICS_EVENT_PATH) ||
    (platformEnv.isDesktop && path.includes(SENTRY_IPC))
  );
