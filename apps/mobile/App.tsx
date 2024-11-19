/* eslint-disable @typescript-eslint/no-unused-vars, import/first, import/order */
import '@onekeyhq/shared/src/polyfills';

import { KitProvider } from '@onekeyhq/kit';
import * as Sentry from '@onekeyhq/shared/src/modules3rdParty/sentry';

Sentry.init({
  dsn: 'https://efa7cea7131f10dc294bd2c64bd636bf@o4508208799809536.ingest.de.sentry.io/4508208802627664',

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // enableSpotlight: __DEV__,
});

export default Sentry.wrap(KitProvider);
