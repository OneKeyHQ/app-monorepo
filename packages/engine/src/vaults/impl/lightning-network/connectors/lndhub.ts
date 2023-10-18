import type VaultLightning from '@onekeyhq/engine/src/vaults/impl/lightning-network/Vault';

import { getBtcProvider } from '../helper/account';

import type { Engine } from '../../../..';
import type { SignMessageResponse } from '../types/webln';

export default class LndHub {
  async signMessage({
    password,
    engine,
    entropy,
    message,
    path,
    isTestnet,
  }: {
    engine: Engine;
    password: string;
    entropy: Buffer;
    message: string;
    path: string;
    isTestnet: boolean;
  }): Promise<SignMessageResponse> {
    const provider = await getBtcProvider(engine, isTestnet);
    const result = provider.signMessage({
      password,
      entropy,
      path: `${path}/0/0`,
      message,
    });
    return {
      message,
      signature: result.toString('hex'),
    };
  }

  async verifyMessage({
    engine,
    accountId,
    networkId,
    message,
    signature,
  }: {
    engine: Engine;
    accountId: string;
    networkId: string;
    message: string;
    signature: string;
  }) {
    const vault = (await engine.getVault({
      networkId,
      accountId,
    })) as VaultLightning;
    const address = await vault.getCurrentBalanceAddress();
    const network = await vault.getNetwork();
    const provider = await getBtcProvider(engine, network.isTestnet);
    return provider.verifyMessage({ message, address, signature });
  }
}
