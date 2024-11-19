/* eslint-disable @typescript-eslint/no-unused-vars, import/first, import/order */
import '@onekeyhq/shared/src/polyfills';
import '@onekeyhq/shared/src/web/index.css';

import { KitProvider } from '@onekeyhq/kit';

import {
  initSentry,
  withSentryHOC,
} from '@onekeyhq/shared/src/modules3rdParty/sentry';

initSentry();

export default withSentryHOC(KitProvider);
