import {
  clearDNSCache,
  getDebugSnapshot,
} from '@onekeyfe/react-native-sni-connect';

import type { ISniRequestQaAdapter } from './sniRequestQa';

export const sniRequestQaAdapter: ISniRequestQaAdapter = {
  transportLabel: 'Native SNI module',
  supportsRequestIdSnapshot: true,
  clearDNSCache,
  getDebugSnapshot,
};
