import { KeystoneBitcoinSDK } from '@keystonehq/keystone-sdk';

import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import type { IAirGapSDK } from '../types';

export class AirGapBtcSDK extends KeystoneBitcoinSDK implements IAirGapSDK {
  normalizeGetMultiAccountsPath(path: string) {
    return accountUtils.removePathLastSegment({
      path,
      removeCount: 2,
    });
  }
}
