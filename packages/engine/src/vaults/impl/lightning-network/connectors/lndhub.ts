import type VaultLightning from '@onekeyhq/engine/src/vaults/impl/lightning-network/Vault';
import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/IBackgroundApi';
import type { IServiceBaseProps } from '@onekeyhq/kit-bg/src/services/ServiceBase';

import { getBtcProvider } from '../helper/account';

import type { ExportedSeedCredential } from '../../../../dbs/base';

export default class LndHub {
  backgroundApi: IBackgroundApi;

  constructor({ backgroundApi }: IServiceBaseProps) {
    this.backgroundApi = backgroundApi;
  }

  async signMessage({
    password,
    walletId,
    message,
    path,
    isTestnet,
  }: {
    password: string;
    walletId: string;
    message: string;
    path: string;
    isTestnet: boolean;
  }) {
    const { entropy } = (await this.backgroundApi.engine.dbApi.getCredential(
      walletId,
      password,
    )) as ExportedSeedCredential;
    const provider = await getBtcProvider(this.backgroundApi.engine, isTestnet);
    const result = provider.signMessage(
      password,
      entropy,
      `${path}/0/0`,
      message,
    );
    return result.toString('hex');
  }

  async verifyMessage({
    accountId,
    networkId,
    message,
    signature,
  }: {
    accountId: string;
    networkId: string;
    message: string;
    signature: string;
  }) {
    const vault = (await this.backgroundApi.engine.getVault({
      networkId,
      accountId,
    })) as VaultLightning;
    const address = await vault.getCurrentBalanceAddress();
    const network = await vault.getNetwork();
    const provider = await getBtcProvider(
      this.backgroundApi.engine,
      network.isTestnet,
    );
    return provider.verifyMessage({ message, address, signature });
  }
}
