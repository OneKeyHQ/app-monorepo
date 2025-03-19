import { KeystoneBitcoinSDK } from '@keystonehq/keystone-sdk';

import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

export class AirGapBtcSDK extends KeystoneBitcoinSDK {
  normalizeGetMultiAccountsPath(path: string) {
    return accountUtils.removePathLastSegment({
      path,
      removeCount: 2,
    });
  }
}
