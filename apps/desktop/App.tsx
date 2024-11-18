/* eslint-disable @typescript-eslint/no-unused-vars, import/first, import/order */
import '@onekeyhq/shared/src/polyfills';
import '@onekeyhq/shared/src/web/index.css';

import { KitProvider } from '@onekeyhq/kit';

import * as Sentry from '@sentry/electron';

Sentry.init({
  dsn: 'https://05ed77019985fb3c81f0bcbdbe1774cd@o4508208799809536.ingest.de.sentry.io/4508320047890512',
});

export default KitProvider;
