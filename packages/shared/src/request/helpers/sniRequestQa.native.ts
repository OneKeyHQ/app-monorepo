import { OneKeyLocalError } from '../../errors';
import platformEnv from '../../platformEnv';

import type { ISniRequestQaAdapter } from './sniRequestQa';

const nativeSniConnect = platformEnv.isNativeIOSMacCatalyst
  ? undefined
  : (require('@onekeyfe/react-native-sni-connect') as typeof import('@onekeyfe/react-native-sni-connect'));

const unsupported = async (): Promise<never> => {
  throw new OneKeyLocalError('SNI QA transport diagnostics are unavailable');
};

export const sniRequestQaAdapter: ISniRequestQaAdapter = {
  transportLabel: nativeSniConnect
    ? 'Native SNI module'
    : 'Unsupported transport',
  clearDNSCache: nativeSniConnect?.clearDNSCache ?? unsupported,
  getDebugSnapshot: nativeSniConnect?.getDebugSnapshot ?? unsupported,
};
