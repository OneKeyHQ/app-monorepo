import { VaultBase } from '../../VaultBase';

// @ts-ignore
export default class Vault extends VaultBase {
  // @ts-ignore
  constructor() {
    // $backgroundApiProxy.backgroundApi.engine.getChainOnlyVault('xmr--0')
    throw new Error('VaultXmr is not supported on Extension MV3 background');
  }
}
