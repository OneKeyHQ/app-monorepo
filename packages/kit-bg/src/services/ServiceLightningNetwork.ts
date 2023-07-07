import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import type VaultLightning from '@onekeyhq/engine/src/vaults/impl/lightning-network/Vault';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';

import ServiceBase from './ServiceBase';

@backgroundClass()
export default class ServiceLightningNetwork extends ServiceBase {
  private previousRequestTokenAccountId = '';

  private previousRequestTokenTimestamp: number | null = null;

  private isFetchingToken = false;

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
    if (
      (this.previousRequestTokenAccountId === accountId &&
        this.previousRequestTokenTimestamp &&
        Date.now() - this.previousRequestTokenTimestamp < 10000) ||
      this.isFetchingToken
    ) {
      // Prevent frequent token fetching during  rerender
      return;
    }
    try {
      this.isFetchingToken = true;
      const vault = await this.backgroundApi.engine.getVault({
        networkId,
        accountId,
      });
      const res = await (vault as VaultLightning).exchangeToken(password);
      const address = await (
        vault as VaultLightning
      ).getCurrentBalanceAddress();
      await simpleDb.utxoAccounts.updateLndToken(
        address,
        res.access_token,
        res.refresh_token,
      );
      this.previousRequestTokenAccountId = accountId;
      this.previousRequestTokenTimestamp = Date.now();
    } finally {
      this.isFetchingToken = false;
    }
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
