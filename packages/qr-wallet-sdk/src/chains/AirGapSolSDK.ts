import { KeystoneSolanaSDK } from '@keystonehq/keystone-sdk';

export class AirGapSolSDK extends KeystoneSolanaSDK {
  normalizeGetMultiAccountsPath(path: string) {
    return path;
  }
}
