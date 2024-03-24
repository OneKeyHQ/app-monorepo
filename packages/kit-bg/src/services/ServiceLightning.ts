import {
  backgroundClass,
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EEndpointName } from '@onekeyhq/shared/types/endpoint';

import { vaultFactory } from '../vaults/factory';
import ClientLightning from '../vaults/impls/lightning/sdkLightning/ClientLightning';

import ServiceBase from './ServiceBase';

import type LightningVault from '../vaults/impls/lightning/Vault';

@backgroundClass()
class ServiceLightning extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  async getLnClient(isTestnet: boolean) {
    return this.getClientCache(isTestnet);
  }

  private getClientCache = memoizee(
    async (isTestnet: boolean) => {
      const _client = await this.backgroundApi.serviceLightning.getClient(
        EEndpointName.LN,
      );
      return new ClientLightning(this.backgroundApi, _client, isTestnet);
    },
    {
      maxAge: timerUtils.getTimeDurationMs({ minute: 3 }),
    },
  );

  @backgroundMethod()
  async getInvoiceConfig({ networkId }: { networkId: string }) {
    const { isTestnet } = await this.backgroundApi.serviceNetwork.getNetwork({
      networkId,
    });
    const client = await this.getLnClient(isTestnet);
    return client.getConfig();
  }

  @backgroundMethod()
  async getLightningAddress({
    accountId,
    networkId,
  }: {
    accountId: string;
    networkId: string;
  }) {
    const { addressDetail } =
      await this.backgroundApi.serviceAccount.getAccount({
        accountId,
        networkId,
      });
    return addressDetail.normalizedAddress;
  }

  @backgroundMethod()
  @toastIfError()
  async createInvoice({
    accountId,
    networkId,
    amount,
    description,
  }: {
    accountId: string;
    networkId: string;
    amount: string;
    description?: string;
  }) {
    const { serviceNetwork } = this.backgroundApi;
    const { isTestnet } = await serviceNetwork.getNetwork({ networkId });
    const client = await this.getLnClient(isTestnet);
    return client.createInvoice({
      accountId,
      networkId,
      amount,
      description,
    });
  }

  @backgroundMethod()
  async exchangeToken({
    accountId,
    networkId,
  }: {
    accountId: string;
    networkId: string;
  }) {
    const vault = (await vaultFactory.getVault({
      networkId,
      accountId,
    })) as LightningVault;
    await vault.exchangeToken();
  }

  @backgroundMethod()
  async checkAuth({
    accountId,
    networkId,
  }: {
    accountId: string;
    networkId: string;
  }) {
    const { serviceNetwork } = this.backgroundApi;
    const { isTestnet } = await serviceNetwork.getNetwork({ networkId });
    const client = await this.getLnClient(isTestnet);
    return client.checkAuth({
      accountId,
      networkId,
    });
  }
}

export default ServiceLightning;
