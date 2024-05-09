import axios from 'axios';

import {
  backgroundClass,
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  ILNURLDetails,
  ILNURLError,
  ILNURLPaymentInfo,
} from '@onekeyhq/shared/types/lightning';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

import { vaultFactory } from '../vaults/factory';
import ClientLightning from '../vaults/impls/lightning/sdkLightning/ClientLightning';
import {
  findLnurl,
  isLightningAddress,
  verifyInvoice,
} from '../vaults/impls/lightning/sdkLightning/lnurl';

import ServiceBase from './ServiceBase';

import type LightningVault from '../vaults/impls/lightning/Vault';
import type { AxiosError } from 'axios';

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
      const _client = await this.backgroundApi.serviceLightning.getClient();
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
  async fetchSpecialInvoice({
    paymentHash,
    networkId,
    accountId,
  }: {
    paymentHash: string;
    networkId: string;
    accountId: string;
  }) {
    const vault = await vaultFactory.getVault({
      networkId,
      accountId,
    });
    return (vault as LightningVault).fetchSpecialInvoice({ paymentHash });
  }

  @backgroundMethod()
  async exchangeToken({
    accountId,
    networkId,
  }: {
    accountId: string;
    networkId: string;
  }) {
    const { deviceParams } =
      await this.backgroundApi.servicePassword.promptPasswordVerifyByAccount({
        accountId,
        reason: EReasonForNeedPassword.LightningNetworkAuth,
      });
    await this.backgroundApi.serviceHardware.withHardwareProcessing(
      async () => {
        const vault = (await vaultFactory.getVault({
          networkId,
          accountId,
        })) as LightningVault;
        await vault.exchangeToken();
      },
      { deviceParams },
    );
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

  @backgroundMethod()
  async decodedInvoice({
    paymentRequest,
    networkId,
    accountId,
  }: {
    paymentRequest: string;
    networkId: string;
    accountId: string;
  }) {
    const vault = (await vaultFactory.getVault({
      networkId,
      accountId,
    })) as LightningVault;
    return vault._decodedInvoiceCache(paymentRequest);
  }

  @backgroundMethod()
  async isZeroAmountInvoice({
    paymentRequest,
    networkId,
    accountId,
  }: {
    paymentRequest: string;
    networkId: string;
    accountId: string;
  }) {
    const invoice = await this.decodedInvoice({
      paymentRequest,
      networkId,
      accountId,
    });
    const vault = (await vaultFactory.getVault({
      networkId,
      accountId,
    })) as LightningVault;
    return vault._isZeroAmountInvoice(invoice);
  }

  @backgroundMethod()
  async findAndValidateLnurl({
    toVal,
    networkId,
  }: {
    toVal: string;
    networkId: string;
  }) {
    let lnurl = findLnurl(toVal);
    if (!lnurl && isLightningAddress(toVal)) {
      lnurl = toVal;
    }

    if (!lnurl) {
      return null;
    }

    const { data } =
      await this.backgroundApi.serviceAccountProfile.fetchValidateAddressResult(
        {
          networkId,
          address: toVal,
        },
      );

    if (!data.data.lnurlDetails) {
      throw new Error('Invalid lnurl');
    }

    return data.data.lnurlDetails;
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
      const axiosInstance = axios.create({
        withCredentials: true,
      });
      const response = await axiosInstance.get<ILNURLPaymentInfo | ILNURLError>(
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
        throw new OneKeyError((response.data as ILNURLError).reason);
      }
      return response.data as ILNURLPaymentInfo;
    } catch (e: any) {
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
    paymentInfo: ILNURLPaymentInfo;
    metadata: string;
    amount: number;
    networkId: string;
    accountId: string;
  }) {
    const decodedInvoice = await this.decodedInvoice({
      paymentRequest: paymentInfo.pr,
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

  @backgroundMethod()
  async fetchLnurlWithdrawRequestResult({
    callback,
    pr,
    k1,
  }: {
    callback: string;
    pr: string;
    k1: string;
  }) {
    try {
      const response = await axios.get<{
        status: string;
        reason: string;
      }>(callback, {
        params: {
          k1,
          pr,
        },
      });
      if (response.status >= 500) {
        throw new Error('Recipient server error');
      }

      if (response.data.status.toUpperCase() === 'OK') {
        return response.data;
      }
      throw new OneKeyError(response.data.reason);
    } catch (e) {
      console.error(e);
      const error = e as AxiosError<ILNURLError>;
      if (error.response?.data?.reason) {
        throw new Error(error.response?.data.reason);
      }
      throw e;
    }
  }

  @backgroundMethod()
  async lnurlAuth({
    accountId,
    networkId,
    lnurlDetail,
  }: {
    accountId: string;
    networkId: string;
    lnurlDetail: ILNURLDetails;
  }) {
    if (lnurlDetail.tag !== 'login') {
      throw new Error('lnurl-auth: invalid tag');
    }
    const vault = (await vaultFactory.getVault({
      networkId,
      accountId,
    })) as LightningVault;

    const { password, deviceParams } =
      await this.backgroundApi.servicePassword.promptPasswordVerifyByAccount({
        accountId,
        reason: EReasonForNeedPassword.LightningNetworkAuth,
      });

    const loginURL =
      await this.backgroundApi.serviceHardware.withHardwareProcessing(
        async () => vault.getLnurlAuthUrl({ lnurlDetail, password }),
        { deviceParams },
      );
    try {
      const response = await axios.get<{
        reason?: string;
        status: string;
      }>(loginURL.toString());
      // if the service returned with a HTTP 200 we still check if the response data is OK
      if (response?.data.status?.toUpperCase() !== 'OK') {
        throw new Error(response?.data?.reason || 'Auth: Something went wrong');
      }

      return response.data;
    } catch (e) {
      if (axios.isAxiosError(e)) {
        console.error('LNURL-AUTH FAIL:', e);
        const error =
          (e.response?.data as { reason?: string })?.reason || e.message; // lnurl error or exception message
        throw new Error(error);
      }
      throw e;
    }
  }
}

export default ServiceLightning;
