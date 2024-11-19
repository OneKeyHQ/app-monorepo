/* eslint-disable @typescript-eslint/no-unused-vars, import/first, import/order */
import '@onekeyhq/shared/src/polyfills';

import { KitProvider } from '@onekeyhq/kit';
import {
  initSentry,
  withProfiler,
  wrap,
} from '@onekeyhq/shared/src/modules3rdParty/sentry';

initSentry();

export default withProfiler(wrap(KitProvider));
