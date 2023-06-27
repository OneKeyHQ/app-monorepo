import type VaultLightning from '@onekeyhq/engine/src/vaults/impl/lightning-network/Vault';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';

import ServiceBase from './ServiceBase';

@backgroundClass()
export default class ServiceLightningNetwork extends ServiceBase {
  @backgroundMethod()
  async refreshToken({
    networkId,
    accountId,
    password,
  }: {
    networkId: string;
    accountId: string;
    password: string;
  }) {
    const vault = await this.backgroundApi.engine.getVault({
      networkId,
      accountId,
    });
    await (vault as VaultLightning).exchangeToken(password);
  }

  @backgroundMethod()
  async createInvoice({
    networkId,
    accountId,
    amount,
    description,
  }: {
    networkId: string;
    accountId: string;
    amount: string;
    description?: string;
  }) {
    const vault = await this.backgroundApi.engine.getVault({
      networkId,
      accountId,
    });
    const invoice = (vault as VaultLightning).createInvoice(
      amount,
      description,
    );
    return invoice;
  }
}
