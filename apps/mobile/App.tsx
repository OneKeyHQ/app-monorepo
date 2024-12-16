/* eslint-disable @typescript-eslint/no-unused-vars, import/first, import/order */
import '@onekeyhq/shared/src/polyfills';

import { KitProvider } from '@onekeyhq/kit';
import { withSentryHOC } from '@onekeyhq/shared/src/modules3rdParty/sentry';

export default withSentryHOC(KitProvider);
