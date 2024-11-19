/* eslint-disable @typescript-eslint/no-unused-vars, import/first, import/order */
import '@onekeyhq/shared/src/polyfills';
import '@onekeyhq/shared/src/web/index.css';

import { KitProvider } from '@onekeyhq/kit';

import * as Sentry from '@onekeyhq/shared/src/modules3rdParty/sentry';

Sentry.init({});

export default KitProvider;
