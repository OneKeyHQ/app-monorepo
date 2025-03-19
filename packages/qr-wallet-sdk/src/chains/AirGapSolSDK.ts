import { KeystoneSolanaSDK } from '@keystonehq/keystone-sdk';

import type { IAirGapSDK } from '../types';

export class AirGapSolSDK extends KeystoneSolanaSDK implements IAirGapSDK {
  normalizeGetMultiAccountsPath(path: string) {
    return path;
  }
}
