import axios from 'axios';
import BigNumber from 'bignumber.js';
import { isEqual, isNil, isNumber, isString } from 'lodash';
import pTimeout from 'p-timeout';

import {
  backgroundClass,
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  HYPER_LIQUID_ORIGIN,
  HYPER_LIQUID_WEBVIEW_TRADE_URL,
} from '@onekeyhq/shared/src/consts/perp';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import thirdpartyLocaleConverter from '@onekeyhq/shared/src/locale/thirdpartyLocaleConverter';
import type { ILocaleSymbol } from '@onekeyhq/shared/src/locale/type';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import cacheUtils from '@onekeyhq/shared/src/utils/cacheUtils';
import extUtils from '@onekeyhq/shared/src/utils/extUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IApiClientResponse } from '@onekeyhq/shared/types/endpoint';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type {
  IHyperLiquidSignatureRSV,
  IHyperLiquidTypedDataApproveBuilderFee,
  IHyperLiquidUserBuilderFeeStatus,
} from '@onekeyhq/shared/types/hyperliquid';

import { settingsPersistAtom } from '../../states/jotai/atoms';
import ServiceBase from '../ServiceBase';

import type {
  IHyperliquidCustomSettings,
  ISimpleDbPerpConfig,
} from '../../dbs/simple/entity/SimpleDbEntityPerp';
import type {
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';

export interface IHyperliquidClearinghouseState {
  marginSummary: {
    accountValue: string;
    totalNtlPos: string;
    totalRawUsd: string;
    totalMarginUsed: string;
  };
  withdrawable: string;
  assetPositions: Array<{
    position: {
      coin: string;
      entryPx?: string;
      leverage: {
        type: string;
        value: number;
      };
      liquidationPx?: string;
      marginUsed: string;
      maxLeverage: number;
      positionValue: string;
      returnOnEquity: string;
      szi: string;
      unrealizedPnl: string;
    };
    type: string;
  }>;
  crossMaintenanceMarginUsed: string;
  crossMarginSummary: {
    accountValue: string;
    totalMarginUsed: string;
    totalNtlPos: string;
    totalRawUsd: string;
  };
  time: number;
}

export interface IHyperliquidSubAccount {
  name: string;
  subAccountUser: string;
  clearinghouseState: IHyperliquidClearinghouseState;
  spotState?: {
    balances: Array<{
      coin: string;
      total: string;
      hold: string;
    }>;
  };
}

export interface IHyperliquidUserFunding {
  coin: string;
  fundingRate: string;
  szi: string;
  usd: string;
  time: number;
}

export interface IHyperliquidLedgerUpdate {
  coin?: string;
  delta: string;
  hash: string;
  time: number;
  type: string;
}

export interface IHyperliquidVaultEquity {
  allTime: {
    pnl: string;
    vlm: string;
  };
  day: {
    pnl: string;
    vlm: string;
  };
  totalDeposited: string;
  totalWithdrawn: string;
  vault: string;
  vaultAddress: string;
  withdrawable: string;
}

export type IHyperliquidMaxBuilderFee = number;

export interface IHyperliquidApproveBuilderFeeRequest {
  userAddress: string;
  builderAddress: string;
  maxFeeRate: string;
  signature: IHyperLiquidSignatureRSV;
  nonce: number;
  vaultAddress?: string | null;
}

export interface IHyperliquidExchangeResponse {
  status: string;
  response: {
    type: string;
    data?: any;
  };
}

@backgroundClass()
class ServiceWebviewPerp extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  async initializePerpConfig() {
    // TODO init by server api
  }

  @backgroundMethod()
  async updatePerpConfig({
    address,
    fee,
    customSettings,
    customLocalStorage,
  }: {
    address?: string;
    fee?: number;
    customSettings?: IHyperliquidCustomSettings;
    customLocalStorage?: Record<string, any>;
  }) {
    let shouldNotifyToDapp = false;
    await this.backgroundApi.simpleDb.perp.setPerpConfig(
      (prev): ISimpleDbPerpConfig => {
        const newConfig: ISimpleDbPerpConfig = {
          ...prev,
          hyperliquidBuilderAddress: address || prev?.hyperliquidBuilderAddress,
          hyperliquidMaxBuilderFee: isNil(fee)
            ? prev?.hyperliquidMaxBuilderFee
            : fee,
          hyperliquidCustomSettings:
            customSettings || prev?.hyperliquidCustomSettings,
          hyperliquidCustomLocalStorage:
            customLocalStorage || prev?.hyperliquidCustomLocalStorage,
        };
        if (isEqual(newConfig, prev)) {
          return prev || {};
        }
        shouldNotifyToDapp = true;
        return newConfig;
      },
    );
    if (shouldNotifyToDapp) {
      const config = await this.backgroundApi.simpleDb.perp.getPerpConfig();
      await this.backgroundApi.serviceDApp.notifyHyperliquidPerpConfigChanged({
        hyperliquidBuilderAddress: config.hyperliquidBuilderAddress,
        hyperliquidMaxBuilderFee: config.hyperliquidMaxBuilderFee,
      });
    }
  }

  private async hyperliquidRequestBase<T>(
    endpoint: string,
    body: Record<string, any>,
  ): Promise<T> {
    try {
      const response = await axios.post<T>(
        `https://api.hyperliquid.xyz/${endpoint}`,
        body,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
      const responseDataWithError = response.data as {
        response: string | object;
        status: 'err' | 'ok';
      };
      // response: "Must deposit before performing actions. User: 0x00"
      // status: "err"
      if (responseDataWithError?.status === 'err') {
        const errorMessage: string =
          typeof responseDataWithError.response === 'string'
            ? responseDataWithError.response
            : stringUtils.stableStringify(responseDataWithError.response);
        throw new OneKeyError(errorMessage);
      }
      return response.data;
    } catch (error) {
      if (error && axios.isAxiosError(error)) {
        const errorMessage = `Hyperliquid API error 8712: ${[
          error?.name,
          error?.code,
          error?.message,
          error?.response?.status,
          error?.response?.statusText,
          isString(error?.response?.data) ? error?.response?.data : undefined,
        ]
          .filter(Boolean)
          .join(',')}`;

        throw new OneKeyError(errorMessage);
      }
      const e = error as IOneKeyError | undefined;
      if (e instanceof OneKeyError) {
        throw e;
      }
      throw new OneKeyError(
        `Hyperliquid API error 6632: ${[
          e?.name,
          e?.code,
          e?.message,
          e?.className,
        ]
          .filter(Boolean)
          .join(',')}`,
      );
    }
  }

  private async hyperliquidInfoRequest<T>(
    body: Record<string, any>,
  ): Promise<T> {
    return this.hyperliquidRequestBase<T>('info', body);
  }

  private async hyperliquidExchangeRequest<T>(
    body: Record<string, any>,
  ): Promise<T> {
    return this.hyperliquidRequestBase<T>('exchange', body);
  }

  @backgroundMethod()
  async getClearinghouseState({
    userAddress,
  }: {
    userAddress: string;
  }): Promise<IHyperliquidClearinghouseState> {
    return this.hyperliquidInfoRequest<IHyperliquidClearinghouseState>({
      type: 'clearinghouseState',
      user: userAddress.toLowerCase(),
    });
  }

  @backgroundMethod()
  async getSubAccounts({
    userAddress,
  }: {
    userAddress: string;
  }): Promise<IHyperliquidSubAccount[]> {
    return this.hyperliquidInfoRequest<IHyperliquidSubAccount[]>({
      type: 'subAccounts',
      user: userAddress.toLowerCase(),
    });
  }

  @backgroundMethod()
  async getUserFunding({
    userAddress,
    startTime,
    endTime,
  }: {
    userAddress: string;
    startTime: number;
    endTime?: number;
  }): Promise<IHyperliquidUserFunding[]> {
    const requestBody: Record<string, any> = {
      type: 'userFunding',
      user: userAddress.toLowerCase(),
      startTime,
    };

    if (endTime !== undefined) {
      requestBody.endTime = endTime;
    }

    return this.hyperliquidInfoRequest<IHyperliquidUserFunding[]>(requestBody);
  }

  @backgroundMethod()
  async getUserNonFundingLedgerUpdates({
    userAddress,
    startTime,
    endTime,
  }: {
    userAddress: string;
    startTime: number;
    endTime?: number;
  }): Promise<IHyperliquidLedgerUpdate[]> {
    const requestBody: Record<string, any> = {
      type: 'userNonFundingLedgerUpdates',
      user: userAddress.toLowerCase(),
      startTime,
    };

    if (endTime !== undefined) {
      requestBody.endTime = endTime;
    }

    return this.hyperliquidInfoRequest<IHyperliquidLedgerUpdate[]>(requestBody);
  }

  @backgroundMethod()
  async getUserVaultEquities({
    userAddress,
  }: {
    userAddress: string;
  }): Promise<IHyperliquidVaultEquity[]> {
    return this.hyperliquidInfoRequest<IHyperliquidVaultEquity[]>({
      type: 'userVaultEquities',
      user: userAddress.toLowerCase(),
    });
  }

  @backgroundMethod()
  async getUserApprovedMaxBuilderFee({
    userAddress,
    builderAddress,
  }: {
    userAddress: string;
    builderAddress: string;
  }): Promise<IHyperliquidMaxBuilderFee> {
    return this.hyperliquidInfoRequest<IHyperliquidMaxBuilderFee>({
      type: 'maxBuilderFee',
      user: userAddress.toLowerCase(),
      builder: builderAddress.toLowerCase(),
    });
  }

  getUserApprovedMaxBuilderFeeWithCache = cacheUtils.memoizee(
    async ({
      userAddress,
      builderAddress,
    }: {
      userAddress: string;
      builderAddress: string;
    }) => {
      return this.getUserApprovedMaxBuilderFee({ userAddress, builderAddress });
    },
    {
      max: 20,
      maxAge: timerUtils.getTimeDurationMs({ hour: 1 }),
      promise: true,
    },
  );

  clearUserApprovedMaxBuilderCache() {
    this.getUserApprovedMaxBuilderFeeWithCache.clear();
  }

  @backgroundMethod()
  async getAccountBalance({ userAddress }: { userAddress: string }): Promise<{
    accountValue: string;
    withdrawable: string;
    totalMarginUsed: string;
    totalNtlPos: string;
  }> {
    const clearinghouse = await this.getClearinghouseState({ userAddress });
    return {
      accountValue: clearinghouse.marginSummary.accountValue,
      withdrawable: clearinghouse.withdrawable,
      totalMarginUsed: clearinghouse.marginSummary.totalMarginUsed,
      totalNtlPos: clearinghouse.marginSummary.totalNtlPos,
    };
  }

  @backgroundMethod()
  async getOpenPositions({
    userAddress,
  }: {
    userAddress: string;
  }): Promise<IHyperliquidClearinghouseState['assetPositions']> {
    const clearinghouse = await this.getClearinghouseState({ userAddress });
    return clearinghouse.assetPositions.filter(
      (position) => parseFloat(position.position.szi) !== 0,
    );
  }

  @backgroundMethod()
  async getAccountSummary({ userAddress }: { userAddress: string }): Promise<{
    balance: {
      accountValue: string;
      withdrawable: string;
      totalMarginUsed: string;
      totalNtlPos: string;
    };
    openPositions: IHyperliquidClearinghouseState['assetPositions'];
    subAccounts: IHyperliquidSubAccount[];
  }> {
    const [balance, openPositions, subAccounts] = await Promise.all([
      this.getAccountBalance({ userAddress }),
      this.getOpenPositions({ userAddress }),
      this.getSubAccounts({ userAddress }),
    ]);

    return {
      balance,
      openPositions,
      subAccounts,
    };
  }

  @backgroundMethod()
  async createApproveBuilderFeePayload({
    builderAddress,
    maxFeeRate,
    chainId,
  }: {
    builderAddress: string;
    maxFeeRate: string;
    chainId: string; // 0xa4b1 Arbitrum hex chainId
  }): Promise<{
    apiPayload: Record<string, any>;
    typedData: IHyperLiquidTypedDataApproveBuilderFee;
  }> {
    const nonce = Date.now();
    // Create EIP-712 typed data for signing
    const typedData: IHyperLiquidTypedDataApproveBuilderFee = {
      domain: {
        name: 'HyperliquidSignTransaction',
        version: '1',
        chainId: new BigNumber(chainId).toNumber(), // 42161
        verifyingContract: '0x0000000000000000000000000000000000000000',
      },
      message: {
        maxFeeRate,
        builder: builderAddress?.toLowerCase(),
        nonce,
        hyperliquidChain: 'Mainnet', // TODO testnet support
        signatureChainId: chainId,
        type: 'approveBuilderFee', // TODO type is only to api
      },
      primaryType: 'HyperliquidTransaction:ApproveBuilderFee',
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' },
        ],
        'HyperliquidTransaction:ApproveBuilderFee': [
          { name: 'hyperliquidChain', type: 'string' },
          { name: 'maxFeeRate', type: 'string' },
          { name: 'builder', type: 'address' },
          { name: 'nonce', type: 'uint64' },
        ],
      },
    };

    const apiPayload = {
      action: typedData.message,
      nonce,
      signature: null,
      vaultAddress: null,
    };

    return {
      apiPayload,
      typedData,
    };
  }

  parseSignatureToRSV(signature: string): IHyperLiquidSignatureRSV {
    // Remove 0x prefix if present
    const cleanSig = signature.replace(/^0x/, '');

    // Extract r, s, v components
    const r = `0x${cleanSig.slice(0, 64)}`;
    const s = `0x${cleanSig.slice(64, 128)}`;
    const v = parseInt(cleanSig.slice(128, 130), 16);

    return { r, s, v };
  }

  async callEthereumProviderMethod<T>(data: IJsonRpcRequest) {
    const resp = await this.backgroundApi.handleProviderMethods<T>({
      scope: 'ethereum',
      origin: HYPER_LIQUID_ORIGIN,
      data,
    });
    return resp;
  }

  @backgroundMethod()
  @toastIfError()
  async approveBuilderFeeIfRequired({
    request,
    userAddress,
    chainId,
    skipApproveAction,
  }: {
    request: IJsBridgeMessagePayload;
    userAddress: string;
    // eslint-disable-next-line spellcheck/spell-checker
    chainId: string; // 0xa4b1 Arbitrum hex chainId
    skipApproveAction?: boolean;
  }): Promise<IHyperLiquidUserBuilderFeeStatus> {
    const status = await this.getUserBuilderFeeStatus({
      userAddress,
    });
    if (
      !skipApproveAction &&
      status.expectBuilderAddress &&
      isNumber(status.expectMaxBuilderFee) &&
      status.expectMaxBuilderFee >= 0 &&
      !status.isApprovedDone &&
      status.canSetBuilderFee
    ) {
      this.clearUserApprovedMaxBuilderCache();
      const { apiPayload, typedData } =
        await this.createApproveBuilderFeePayload({
          builderAddress: status.expectBuilderAddress,
          // expectMaxBuilderFee is 13, but we need to convert it to a string like 0.013%
          maxFeeRate: `${new BigNumber(status.expectMaxBuilderFee)
            .div(1000)
            .toFixed(3)}%`,
          chainId,
        });
      const resp = await this.callEthereumProviderMethod<string>({
        method: 'eth_signTypedData_v4',
        params: [userAddress, stringUtils.stableStringify(typedData)],
      });
      const signature = resp.result;
      const rsv = this.parseSignatureToRSV(signature);
      apiPayload.signature = rsv;
      try {
        const p =
          this.hyperliquidExchangeRequest<IHyperliquidExchangeResponse>(
            apiPayload,
          );
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const response = await pTimeout(p, {
          milliseconds: 5000,
        });
        return status;
      } catch (e) {
        return { ...status, expectBuilderAddress: '', expectMaxBuilderFee: 0 };
      }
    }
    return status;
  }

  @backgroundMethod()
  async connectToDapp() {
    const resp = await this.callEthereumProviderMethod<string[]>({
      method: 'eth_requestAccounts',
      params: [],
    });
    return resp.result as string[];
  }

  @backgroundMethod()
  async disconnectFromDapp() {
    await this.backgroundApi.serviceDApp.disconnectWebsite({
      origin: HYPER_LIQUID_ORIGIN,
      storageType: 'injectedProvider',
      entry: 'Browser',
    });
  }

  @backgroundMethod()
  async updateBuilderFeeConfigByServer() {
    const client = await this.getClient(EServiceEndpointEnum.Utility);
    const resp = await client.get<
      IApiClientResponse<{
        referrerAddress: string;
        referrerRate: number;
        customSettings: IHyperliquidCustomSettings;
        customLocalStorage: Record<string, any>;
      }>
    >('/utility/v1/perp-config');
    const resData = resp.data;
    // TODO remove
    // if (resData.data) {
    //   resData.data.customSettings = {
    //     hideNavBar: false,
    //     hideNavBarConnectButton: false,
    //     hideNotOneKeyWalletConnectButton: false,
    //   };
    //   resData.data.customLocalStorage = {
    //     'hyperliquid.coin_selector.tab': `"spot"`, // "perps", "all", "spot"
    //     'activeCoin': 'AAA', // do not use `"BTC"`
    //   };
    // }
    await this.updatePerpConfig({
      address: resData?.data?.referrerAddress,
      fee: resData?.data?.referrerRate,
      customSettings: resData?.data?.customSettings,
      customLocalStorage: resData?.data?.customLocalStorage,
    });
    return resData;
  }

  updateBuilderFeeConfigByServerWithCache = cacheUtils.memoizee(
    async () => {
      return this.updateBuilderFeeConfigByServer();
    },
    {
      max: 20,
      maxAge: timerUtils.getTimeDurationMs({ hour: 1 }),
      promise: true,
    },
  );

  isLocaleUpdatedByDappDone = false;

  @backgroundMethod()
  async getBuilderFeeConfig() {
    void this.updateBuilderFeeConfigByServerWithCache();
    // try {
    //   const p = this.updateBuilderFeeConfigByServer();
    //   await pTimeout(p, {
    //     milliseconds: 1000,
    //   });
    // } catch (error) {
    //   console.error(error);
    // }
    const shouldModifyPlaceOrderPayload = true;
    // Get builderAddress and builderFeeValue from simpleDB
    const expectBuilderAddress =
      (await this.backgroundApi.simpleDb.perp.getExpectBuilderAddress()) || '';
    // Need to check this formula returns an integer in the browser: 1e5 * (num/1e5)
    let expectMaxBuilderFee =
      (await this.backgroundApi.simpleDb.perp.getExpectMaxBuilderFee()) || 0; // 1e5 * (num/1e5)
    const { hyperliquidCustomSettings, hyperliquidCustomLocalStorage } =
      await this.backgroundApi.simpleDb.perp.getPerpConfig();
    if (expectMaxBuilderFee < 0) {
      expectMaxBuilderFee = 0;
    }
    let locale: ILocaleSymbol | undefined;
    let storedLocale: ILocaleSymbol | undefined;
    let localeStr = '';
    if (!this.isLocaleUpdatedByDappDone) {
      ({ locale: storedLocale } = await settingsPersistAtom.get());
      locale = await this.backgroundApi.serviceSetting.getCurrentLocale();
      if (locale) {
        localeStr =
          thirdpartyLocaleConverter.toHyperLiquidWebDappLocale(locale);
      }
      this.isLocaleUpdatedByDappDone = true;
    }
    const customLocalStorage: Record<string, any> = {
      'hyperliquid.coin_selector.tab': `"perps"`, // "perps", "all", "spot"
      'activeCoin': 'BTC', // do not use `"BTC"`
      ...hyperliquidCustomLocalStorage,
    };
    if (localeStr) {
      // hyperliquid.locale-setting: "zh-CN"
      customLocalStorage['hyperliquid.locale-setting'] = `"${localeStr}"`;
    }
    return {
      locale: localeStr,
      storedLocale,
      customLocalStorage,
      expectBuilderAddress,
      expectMaxBuilderFee,
      shouldModifyPlaceOrderPayload,
      customSettings: hyperliquidCustomSettings,
    };
  }

  async getUserBuilderFeeStatus({
    userAddress,
  }: {
    userAddress: string;
  }): Promise<IHyperLiquidUserBuilderFeeStatus> {
    const {
      expectBuilderAddress,
      expectMaxBuilderFee,
      shouldModifyPlaceOrderPayload,
    } = await this.getBuilderFeeConfig();
    let currentMaxBuilderFee = 0;
    let isApprovedDone = false;
    let canSetBuilderFee = false;
    let accountValue: string | null = null;

    if (expectBuilderAddress) {
      try {
        const p = this.getUserApprovedMaxBuilderFeeWithCache({
          userAddress,
          builderAddress: expectBuilderAddress,
        });
        currentMaxBuilderFee = await pTimeout(p, {
          milliseconds: 5000,
        });
        // const shouldModifyPlaceOrderPayload = false;
        if (currentMaxBuilderFee === expectMaxBuilderFee) {
          isApprovedDone = true;
          canSetBuilderFee = true;
          accountValue = null;
        }
      } catch (error) {
        console.error(error);
      }
    }

    if (!isApprovedDone) {
      try {
        const p = this.getAccountBalance({
          userAddress,
        });

        ({ accountValue } = await pTimeout(p, {
          milliseconds: 5000,
        }));

        // TODO new address value check
        canSetBuilderFee = Number(accountValue) >= 0;
      } catch (error) {
        console.error(error);
      }
    }

    return {
      isApprovedDone,
      canSetBuilderFee,
      currentMaxBuilderFee,
      expectMaxBuilderFee: canSetBuilderFee ? expectMaxBuilderFee : 0,
      expectBuilderAddress: canSetBuilderFee ? expectBuilderAddress : '',
      accountValue,
      shouldModifyPlaceOrderPayload,
    };
  }

  lastExtPerpTab: chrome.tabs.Tab | undefined;

  @backgroundMethod()
  async openExtPerpTab() {
    if (platformEnv.isExtension) {
      this.lastExtPerpTab = await extUtils.openUrlInTab(
        HYPER_LIQUID_WEBVIEW_TRADE_URL,
        {
          tabId: this.lastExtPerpTab?.id,
        },
      );
    }
  }
}

export default ServiceWebviewPerp;
