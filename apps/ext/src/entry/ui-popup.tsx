/* oxlint-disable import-js/order */
// Runtime polyfills must execute before performance and application modules.
import '@onekeyhq/shared/src/polyfills';
import '@onekeyhq/shared/src/performance/init';

import ui from './ui';

ui.init();
