import { devSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IFiatCryptoToken,
  IFiatCryptoType,
  IGenerateWidgetUrl,
  IGenerateWidgetUrlResponse,
  IGenerateWidgetUrlWithAccountId,
  IGetTokensListParams,
} from '@onekeyhq/shared/types/fiatCrypto';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceFiatCrypto extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  _buildUriForFiatToken = memoizee(
    async (params: IGenerateWidgetUrl) => {
      const client = await this.getClient();
      const { enabled: isDev } = await devSettingsPersistAtom.get();
      const resp = await client.get<{
        data: string;
      }>('/wallet/v1/fiat-pay/url', {
        params: { ...params, mode: isDev ? 'test' : 'live' },
      });
      return resp.data.data;
    },
    {
      promise: true,
      maxAge: timerUtils.getTimeDurationMs({ minute: 5 }),
    },
  );

  @backgroundMethod()
  public async generateWidgetUrl(
    params: IGenerateWidgetUrlWithAccountId,
  ): Promise<IGenerateWidgetUrlResponse> {
    const { accountId, ...rest } = params;
    let address: string | undefined;
    if (accountId) {
      address = await this.backgroundApi.serviceAccount.getAccountAddressForApi(
        {
          networkId: rest.networkId,
          accountId,
        },
      );
    }
    const url = await this._buildUriForFiatToken({ ...rest, address });
    return { url };
  }

  _getTokensList = memoizee(
    async (params: {
      networkId: string;
      type: IFiatCryptoType;
      address?: string;
    }) => {
      const client = await this.getClient();
      const resp = await client.get<{
        data: IFiatCryptoToken[];
      }>('/wallet/v1/fiat-pay/list', { params });
      return resp.data.data;
    },
    {
      promise: true,
      maxAge: timerUtils.getTimeDurationMs({ minute: 5 }),
    },
  );

  @backgroundMethod()
  public async getTokensList(
    params: IGetTokensListParams,
  ): Promise<IFiatCryptoToken[]> {
    const { networkId, accountId } = params;
    let address: string | undefined;
    if (accountId) {
      address = await this.backgroundApi.serviceAccount.getAccountAddressForApi(
        {
          networkId,
          accountId,
        },
      );
    }
    return this._getTokensList({
      networkId,
      address,
      type: params.type,
    });
  }

  @backgroundMethod()
  public async isNetworkSupported(params: IGetTokensListParams) {
    const tokens = await this.getTokensList(params);
    return tokens.length > 0;
  }

  @backgroundMethod()
  public async isTokenSupported(
    params: IGetTokensListParams & { tokenAddress: string },
  ): Promise<boolean> {
    const res = await this.generateWidgetUrl(params);
    const isSupported = Boolean(res.url);
    return isSupported;
  }
}

export default ServiceFiatCrypto;
