import axios from 'axios';

import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import { OneKeyError } from '@onekeyhq/engine/src/errors';
import {
  getLnurlDetails,
  verifyInvoice,
} from '@onekeyhq/engine/src/vaults/impl/lightning-network/helper/lnurl';
import type {
  LNURLError,
  LNURLPaymentInfo,
} from '@onekeyhq/engine/src/vaults/impl/lightning-network/types/lnurl';
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

  @backgroundMethod()
  async fetchSpecialInvoice({
    paymentHash,
    networkId,
    accountId,
  }: {
    paymentHash: string;
    networkId: string;
    accountId: string;
  }) {
    const vault = await this.backgroundApi.engine.getVault({
      networkId,
      accountId,
    });
    return (vault as VaultLightning).fetchSpecialInvoice(paymentHash);
  }

  @backgroundMethod()
  async decodedInvoice({
    payReq,
    networkId,
    accountId,
  }: {
    payReq: string;
    networkId: string;
    accountId: string;
  }) {
    const vault = await this.backgroundApi.engine.getVault({
      networkId,
      accountId,
    });
    return (vault as VaultLightning)._decodedInvoceCache(payReq);
  }

  @backgroundMethod()
  async isZeroAmountInvoice({
    payReq,
    networkId,
    accountId,
  }: {
    payReq: string;
    networkId: string;
    accountId: string;
  }) {
    const vault = (await this.backgroundApi.engine.getVault({
      networkId,
      accountId,
    })) as VaultLightning;
    const invoice = await vault._decodedInvoceCache(payReq);
    return vault.isZeroAmountInvoice(invoice);
  }

  @backgroundMethod()
  async checkAuth({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }) {
    const vault = await this.backgroundApi.engine.getVault({
      networkId,
      accountId,
    });
    return (vault as VaultLightning)
      .checkAuth()
      .then(() => false)
      .catch((e) => {
        console.log('check auth error: ', e);
        return true;
      });
  }

  @backgroundMethod()
  async getInvoiceConfig({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }) {
    const vault = (await this.backgroundApi.engine.getVault({
      networkId,
      accountId,
    })) as VaultLightning;
    const client = await vault.getClient();
    const address = await vault.getCurrentBalanceAddress();
    return client.getConfig(address);
  }

  @backgroundMethod()
  async validateZeroInvoiceMaxSendAmount({
    accountId,
    networkId,
    amount,
  }: {
    networkId: string;
    accountId: string;
    amount: string;
  }) {
    const vault = await this.backgroundApi.engine.getVault({
      networkId,
      accountId,
    });
    // @ts-expect-error
    return vault.validateSendAmount(amount);
  }

  @backgroundMethod()
  async getLnurlDetails(lnurl: string) {
    return getLnurlDetails(lnurl);
  }

  @backgroundMethod()
  async fetchLnurlPayRequestResult({
    callback,
    params,
  }: {
    callback: string;
    params: {
      amount: number;
      comment?: string;
    };
  }) {
    try {
      const response = await axios.get<LNURLPaymentInfo | LNURLError>(
        callback,
        {
          params,
          validateStatus: () => true,
        },
      );
      if (response.status >= 500) {
        throw new OneKeyError('Recipient server error');
      }

      if (!Object.prototype.hasOwnProperty.call(response.data, 'pr')) {
        throw new OneKeyError((response.data as LNURLError).reason);
      }
      return response.data as LNURLPaymentInfo;
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  @backgroundMethod()
  async verifyInvoice({
    paymentInfo,
    metadata,
    amount,
    networkId,
    accountId,
  }: {
    paymentInfo: LNURLPaymentInfo;
    metadata: string;
    amount: number;
    networkId: string;
    accountId: string;
  }) {
    const decodedInvoice = await this.decodedInvoice({
      payReq: paymentInfo.pr,
      networkId,
      accountId,
    });
    return verifyInvoice({
      decodedInvoice,
      paymentInfo,
      metadata,
      amount,
    });
  }
}
