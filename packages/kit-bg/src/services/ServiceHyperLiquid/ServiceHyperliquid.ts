import BigNumber from 'bignumber.js';
import { ethers } from 'ethersV6';
import { isEqual, isNil, omit } from 'lodash';
import pTimeout from 'p-timeout';

import type { ICoreHyperLiquidAgentCredential } from '@onekeyhq/core/src/types';
import {
  backgroundClass,
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  EHyperLiquidAgentName,
  FALLBACK_BUILDER_ADDRESS,
  FALLBACK_MAX_BUILDER_FEE,
  HYPERLIQUID_AGENT_TTL_DEFAULT,
  HYPERLIQUID_REFERRAL_CODE,
  HYPER_LIQUID_CUSTOM_LOCAL_STORAGE_V2_PRESET,
  PERPS_NETWORK_ID,
} from '@onekeyhq/shared/src/consts/perp';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import cacheUtils from '@onekeyhq/shared/src/utils/cacheUtils';
import perfUtils from '@onekeyhq/shared/src/utils/debug/perfUtils';
import perpsUtils from '@onekeyhq/shared/src/utils/perpsUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IApiClientResponse } from '@onekeyhq/shared/types/endpoint';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type {
  IApiRequestError,
  IApiRequestResult,
  IFill,
  IHex,
  IMarginTable,
  IMarginTableMap,
  IPerpsActiveAssetData,
  IPerpsActiveAssetDataRaw,
  IPerpsUniverse,
  IUserFillsByTimeParameters,
  IUserFillsParameters,
  IWsActiveAssetCtx,
  IWsWebData2,
} from '@onekeyhq/shared/types/hyperliquid/sdk';

import localDb from '../../dbs/local/localDb';
import {
  perpsAccountLoadingInfoAtom,
  perpsActiveAccountAtom,
  perpsActiveAccountStatusAtom,
  perpsActiveAccountStatusInfoAtom,
  perpsActiveAccountSummaryAtom,
  perpsActiveAssetAtom,
  perpsActiveAssetCtxAtom,
  perpsActiveAssetDataAtom,
  perpsCommonConfigPersistAtom,
  perpsCurrentMidAtom,
  perpsCustomSettingsAtom,
} from '../../states/jotai/atoms';
import ServiceBase from '../ServiceBase';

import { hyperLiquidApiClients } from './hyperLiquidApiClients';
import hyperLiquidCache from './hyperLiquidCache';

import type ServiceHyperliquidExchange from './ServiceHyperliquidExchange';
import type ServiceHyperliquidWallet from './ServiceHyperliquidWallet';
import type { ISimpleDbPerpData } from '../../dbs/simple/entity/SimpleDbEntityPerp';
import type {
  IPerpsAccountLoadingInfo,
  IPerpsActiveAccountAtom,
  IPerpsActiveAccountStatusDetails,
  IPerpsActiveAccountStatusInfoAtom,
  IPerpsCommonConfigPersistAtom,
  IPerpsCustomSettings,
} from '../../states/jotai/atoms';
import type { IAccountDeriveTypes } from '../../vaults/types';
import type { IHyperliquidMaxBuilderFee } from '../ServiceWebviewPerp';
import type { IPerpServerConfigResponse } from '../ServiceWebviewPerp/ServiceWebviewPerp';

@backgroundClass()
export default class ServiceHyperliquid extends ServiceBase {
  public builderAddress: IHex = FALLBACK_BUILDER_ADDRESS;

  public maxBuilderFee: number = FALLBACK_MAX_BUILDER_FEE;

  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
    void this.init();
  }

  private get exchangeService(): ServiceHyperliquidExchange {
    return this.backgroundApi.serviceHyperliquidExchange;
  }

  private get walletService(): ServiceHyperliquidWallet {
    return this.backgroundApi.serviceHyperliquidWallet;
  }

  private async init() {
    void this.backgroundApi.simpleDb.perp
      .getPerpData()
      .then((config) => {
        this.builderAddress = (config.hyperliquidBuilderAddress ||
          FALLBACK_BUILDER_ADDRESS) as IHex;
        this.maxBuilderFee =
          config.hyperliquidMaxBuilderFee || FALLBACK_MAX_BUILDER_FEE;
      })
      .catch((error) => {
        console.error('Failed to load perp config:', error);
      });
  }

  @backgroundMethod()
  async updatePerpConfig({
    referrerConfig,
    customSettings,
    customLocalStorage,
    customLocalStorageV2,
    commonConfig,
    bannerConfig,
  }: IPerpServerConfigResponse) {
    let shouldNotifyToDapp = false;
    await perpsCommonConfigPersistAtom.set(
      (prev): IPerpsCommonConfigPersistAtom => {
        const newVal = perfUtils.buildNewValueIfChanged(prev, {
          ...prev,
          perpConfigCommon: {
            ...prev.perpConfigCommon,
            // usePerpWeb: true,
            usePerpWeb: commonConfig?.usePerpWeb,
            disablePerp: commonConfig?.disablePerp,
            disablePerpActionPerp: commonConfig?.disablePerpActionPerp,
            perpBannerConfig: bannerConfig,
            ipDisablePerp: commonConfig?.ipDisablePerp,
          },
        });
        return newVal;
      },
    );
    await this.backgroundApi.simpleDb.perp.setPerpData(
      (prev): ISimpleDbPerpData => {
        const newConfig: ISimpleDbPerpData = {
          tradingUniverse: prev?.tradingUniverse,
          marginTablesMap: prev?.marginTablesMap,
          ...prev,
          hyperliquidBuilderAddress:
            referrerConfig?.referrerAddress || prev?.hyperliquidBuilderAddress,
          hyperliquidMaxBuilderFee: isNil(referrerConfig?.referrerRate)
            ? prev?.hyperliquidMaxBuilderFee
            : referrerConfig?.referrerRate,
          agentTTL: referrerConfig.agentTTL ?? prev?.agentTTL,
          referralCode: referrerConfig.referralCode || prev?.referralCode,
          hyperliquidCustomSettings:
            customSettings || prev?.hyperliquidCustomSettings,
          hyperliquidCustomLocalStorage:
            customLocalStorage || prev?.hyperliquidCustomLocalStorage,
          hyperliquidCustomLocalStorageV2:
            customLocalStorageV2 || prev?.hyperliquidCustomLocalStorageV2,
        };
        if (isEqual(newConfig, prev)) {
          return (
            prev || { tradingUniverse: undefined, marginTablesMap: undefined }
          );
        }
        shouldNotifyToDapp = true;
        return newConfig;
      },
    );
    if (shouldNotifyToDapp) {
      const config = await this.backgroundApi.simpleDb.perp.getPerpData();
      await this.backgroundApi.serviceDApp.notifyHyperliquidPerpConfigChanged({
        hyperliquidBuilderAddress: config.hyperliquidBuilderAddress,
        hyperliquidMaxBuilderFee: config.hyperliquidMaxBuilderFee,
      });
    }
  }

  @backgroundMethod()
  async updatePerpsConfigByServer() {
    const client = await this.getClient(EServiceEndpointEnum.Utility);
    const resp = await client.get<
      IApiClientResponse<IPerpServerConfigResponse>
    >('/utility/v1/perp-config');
    const resData = resp.data;

    if (process.env.NODE_ENV !== 'production') {
      // TODO devSettings ignore server config 11
      // TODO remove
      // resData.data.referrerRate = 65;
    }

    await this.updatePerpConfig({
      referrerConfig: resData?.data?.referrerConfig,
      customSettings: resData?.data?.customSettings,
      customLocalStorage: resData?.data?.customLocalStorage,
      customLocalStorageV2: {
        ...HYPER_LIQUID_CUSTOM_LOCAL_STORAGE_V2_PRESET,
        ...resData?.data?.customLocalStorageV2,
      },
      commonConfig: resData?.data?.commonConfig,
      bannerConfig: resData?.data?.bannerConfig,
    });
    return resData;
  }

  @backgroundMethod()
  async getHyperLiquidCache() {
    return { allMids: hyperLiquidCache.allMids };
  }

  @backgroundMethod()
  async updatePerpsConfigByServerWithCache() {
    return this._updatePerpsConfigByServerWithCache();
  }

  _updatePerpsConfigByServerWithCache = cacheUtils.memoizee(
    async () => {
      return this.updatePerpsConfigByServer();
    },
    {
      max: 20,
      maxAge: timerUtils.getTimeDurationMs({ hour: 1 }),
      promise: true,
    },
  );

  @backgroundMethod()
  async getUserFillsByTime(
    params: IUserFillsByTimeParameters,
  ): Promise<IFill[]> {
    const { infoClient } = hyperLiquidApiClients;

    return infoClient.userFillsByTime(params);
  }

  @backgroundMethod()
  async getUserFills(params: IUserFillsParameters): Promise<IFill[]> {
    const { infoClient } = hyperLiquidApiClients;

    return infoClient.userFills(params);
  }

  @backgroundMethod()
  async refreshTradingMeta() {
    const { infoClient } = hyperLiquidApiClients;
    // const dexList = (await this.infoClient.perpDexs()).filter(Boolean);
    const meta = await infoClient.meta({
      // dex: dexList?.[0]?.name || '',
    });
    if (meta?.universe?.length) {
      const marginTablesMap = meta?.marginTables.reduce((acc, item) => {
        acc[item[0]] = item[1];
        return acc;
      }, {} as IMarginTableMap);
      await this.backgroundApi.simpleDb.perp.setTradingUniverse({
        universe: meta?.universe || [],
        marginTablesMap,
      });
    }
  }

  @backgroundMethod()
  async getTradingUniverse() {
    return this.backgroundApi.simpleDb.perp.getTradingUniverse();
  }

  @backgroundMethod()
  async getSymbolsMetaMap({ coins }: { coins: string[] }) {
    const { universeItems, marginTablesMap } = await this.getTradingUniverse();
    const map: Partial<{
      [coin: string]: {
        coin: string;
        assetId: number;
        universe: IPerpsUniverse | undefined;
        marginTable: IMarginTable | undefined;
      };
    }> = {};
    coins.forEach((coin) => {
      const universe = universeItems.find((item) => item.name === coin);
      if (isNil(universe?.assetId)) {
        throw new OneKeyLocalError(`Asset id not found for coin: ${coin}`);
      }
      map[coin] = {
        assetId: universe?.assetId,
        coin,
        universe,
        marginTable: isNil(universe?.marginTableId)
          ? undefined
          : marginTablesMap?.[universe?.marginTableId],
      };
    });
    return map;
  }

  @backgroundMethod()
  async getSymbolMeta({ coin }: { coin: string }) {
    const map = await this.getSymbolsMetaMap({ coins: [coin] });
    const meta = map[coin];
    return meta;
  }

  @backgroundMethod()
  async getSymbolMidValue({ coin }: { coin: string }) {
    const { allMids } = await this.getHyperLiquidCache();
    const mid = allMids?.mids?.[coin];
    const midBN = new BigNumber(mid);
    if (midBN.isNaN() || midBN.isLessThanOrEqualTo(0)) {
      return undefined;
    }
    return mid;
  }

  async refreshCurrentMid() {
    const selectedSymbol = await perpsActiveAssetAtom.get();
    const currentMid = await perpsCurrentMidAtom.get();
    const midValue = await this.getSymbolMidValue({
      coin: selectedSymbol.coin,
    });
    const newMid = {
      coin: selectedSymbol.coin,
      mid: midValue,
    };
    if (isEqual(currentMid, newMid)) {
      return;
    }
    await perpsCurrentMidAtom.set(newMid);
  }

  async updateActiveAssetCtx(data: IWsActiveAssetCtx | undefined) {
    const activeAsset = await perpsActiveAssetAtom.get();
    if (activeAsset?.coin === data?.coin && data?.coin) {
      await perpsActiveAssetCtxAtom.set({
        coin: data?.coin,
        assetId: activeAsset?.assetId,
        ctx: perpsUtils.formatAssetCtx(data?.ctx),
      });
    } else {
      const activeAssetCtx = await perpsActiveAssetCtxAtom.get();
      if (activeAssetCtx?.coin !== activeAsset?.coin) {
        await perpsActiveAssetCtxAtom.set(undefined);
      }
    }
  }

  async updateActiveAssetData(data: IPerpsActiveAssetDataRaw) {
    const activeAsset = await perpsActiveAssetAtom.get();
    const activeAccount = await perpsActiveAccountAtom.get();
    if (
      data?.user &&
      data?.coin &&
      activeAsset?.coin === data?.coin &&
      activeAccount?.accountAddress?.toLowerCase() === data?.user?.toLowerCase()
    ) {
      await perpsActiveAssetDataAtom.set(
        (_prev): IPerpsActiveAssetData => ({
          ...omit(data, 'user'),
          accountAddress: activeAccount?.accountAddress?.toLowerCase() as IHex,
          coin: data.coin,
          assetId: activeAsset?.assetId,
        }),
      );
    } else {
      const activeAssetData = await perpsActiveAssetDataAtom.get();
      if (
        activeAssetData?.coin !== activeAsset?.coin ||
        activeAssetData?.accountAddress?.toLowerCase() !==
          activeAccount?.accountAddress?.toLowerCase()
      ) {
        await perpsActiveAssetDataAtom.set(undefined);
      }
    }
  }

  async updateActiveAccountSummary(webData2: IWsWebData2) {
    const activeAccount = await perpsActiveAccountAtom.get();
    if (
      activeAccount?.accountAddress &&
      activeAccount?.accountAddress?.toLowerCase() ===
        webData2?.user?.toLowerCase()
    ) {
      // TODO deep compare
      await perpsActiveAccountSummaryAtom.set({
        accountAddress: activeAccount?.accountAddress?.toLowerCase() as IHex,
        accountValue: webData2.clearinghouseState?.marginSummary?.accountValue,
        totalMarginUsed:
          webData2.clearinghouseState?.marginSummary?.totalMarginUsed,
        crossAccountValue:
          webData2.clearinghouseState?.crossMarginSummary.accountValue,
        crossMaintenanceMarginUsed:
          webData2.clearinghouseState?.crossMaintenanceMarginUsed,
        totalNtlPos: webData2.clearinghouseState?.marginSummary?.totalNtlPos,
        totalRawUsd: webData2.clearinghouseState?.marginSummary?.totalRawUsd,
        withdrawable: webData2.clearinghouseState?.withdrawable,
      });
    } else {
      const activeAccountSummary = await perpsActiveAccountSummaryAtom.get();
      // TODO PERPS_EMPTY_ADDRESS check
      if (
        activeAccountSummary?.accountAddress?.toLowerCase() !==
        activeAccount?.accountAddress?.toLowerCase()
      ) {
        // TODO set undefined when account address changed
        await perpsActiveAccountSummaryAtom.set(undefined);
      }
    }
  }

  @backgroundMethod()
  async changeActiveAsset(params: { coin: string }): Promise<{
    universeItems: IPerpsUniverse[];
    selectedUniverse: IPerpsUniverse | undefined;
  }> {
    const oldActiveAsset = await perpsActiveAssetAtom.get();
    const oldCoin = oldActiveAsset?.coin;
    const newCoin = params.coin;
    const { universeItems = [], marginTablesMap } =
      await this.getTradingUniverse();
    const selectedUniverse: IPerpsUniverse | undefined =
      universeItems?.find((item) => item.name === newCoin) ||
      universeItems?.[0];
    const assetId =
      selectedUniverse?.assetId ??
      universeItems.findIndex((token) => token.name === selectedUniverse.name);
    const selectedMargin = marginTablesMap?.[selectedUniverse?.marginTableId];
    await perpsActiveAssetAtom.set({
      coin: selectedUniverse?.name || newCoin || '',
      assetId,
      universe: selectedUniverse,
      margin: selectedMargin,
    });
    if (oldCoin !== newCoin) {
      await perpsActiveAssetCtxAtom.set(undefined);
    }
    await this.refreshCurrentMid();
    return {
      universeItems,
      selectedUniverse,
    };
  }

  hideSelectAccountLoadingTimer: ReturnType<typeof setTimeout> | undefined;

  @backgroundMethod()
  async selectPerpsAccount(params: {
    accountId: string | null;
    indexedAccountId: string | null;
    deriveType: IAccountDeriveTypes;
  }) {
    const { indexedAccountId, accountId, deriveType } = params;

    const perpsAccount: IPerpsActiveAccountAtom = {
      indexedAccountId: indexedAccountId || null,
      accountId: null,
      accountAddress: null,
      deriveType: deriveType || 'default',
    };

    try {
      clearTimeout(this.hideSelectAccountLoadingTimer);
      await perpsAccountLoadingInfoAtom.set(
        (prev): IPerpsAccountLoadingInfo => ({
          ...prev,
          selectAccountLoading: true,
        }),
      );

      console.log('selectPerpsAccount______111', indexedAccountId, accountId);
      if (indexedAccountId || accountId) {
        const ethNetworkId = PERPS_NETWORK_ID;
        const account =
          await this.backgroundApi.serviceAccount.getNetworkAccount({
            indexedAccountId: indexedAccountId ?? undefined,
            accountId: indexedAccountId ? undefined : accountId ?? undefined,
            networkId: ethNetworkId,
            deriveType: deriveType || 'default',
          });
        console.log('selectPerpsAccount______222', account);
        perpsAccount.accountAddress =
          (account.address?.toLowerCase() as IHex) || null;
        if (perpsAccount.accountAddress) {
          perpsAccount.accountId = account.id || null;
        }
        void this.backgroundApi.serviceAccount.saveAccountAddresses({
          account,
          networkId: ethNetworkId,
        });
      }
    } catch (error) {
      console.error(error);
    } finally {
      clearTimeout(this.hideSelectAccountLoadingTimer);
      this.hideSelectAccountLoadingTimer = setTimeout(async () => {
        await perpsAccountLoadingInfoAtom.set(
          (prev): IPerpsAccountLoadingInfo => ({
            ...prev,
            selectAccountLoading: false,
          }),
        );
      }, 0);
    }

    await perpsActiveAccountAtom.set(perpsAccount);
    return perpsAccount;
  }

  @backgroundMethod()
  async setPerpsCustomSettings(settings: IPerpsCustomSettings) {
    await perpsCustomSettingsAtom.set(settings);
  }

  @backgroundMethod()
  async enableTrading() {
    await this.checkPerpsAccountStatus({
      isEnableTradingTrigger: true,
    });
    const status = await perpsActiveAccountStatusAtom.get();
    return status;
  }

  hideEnableTradingLoadingTimer: ReturnType<typeof setTimeout> | undefined;

  @backgroundMethod()
  async checkPerpsAccountStatus({
    password,
    isEnableTradingTrigger = false,
  }: {
    password?: string;
    isEnableTradingTrigger?: boolean;
  } = {}): Promise<void> {
    const { infoClient } = hyperLiquidApiClients;
    const statusDetails: IPerpsActiveAccountStatusDetails = {
      activatedOk: false,
      agentOk: false,
      referralCodeOk: false,
      builderFeeOk: false,
    };
    let status: IPerpsActiveAccountStatusInfoAtom | undefined;

    const selectedAccount = await perpsActiveAccountAtom.get();
    const accountAddress = selectedAccount.accountAddress?.toLowerCase() as
      | IHex
      | undefined;
    let agentCredential: ICoreHyperLiquidAgentCredential | undefined;

    try {
      clearTimeout(this.hideEnableTradingLoadingTimer);
      await perpsAccountLoadingInfoAtom.set(
        (prev): IPerpsAccountLoadingInfo => ({
          ...prev,
          enableTradingLoading: true,
        }),
      );

      // TODO reset exchange client if account not exists, or address not exists
      await this.exchangeService.setup({
        userAddress: accountAddress,
        userAccountId: selectedAccount.accountId ?? undefined,
      });

      if (!accountAddress) {
        throw new OneKeyLocalError(
          'Check perps account status ERROR: Account address is required',
        );
      }

      // eslint-disable-next-line no-param-reassign
      password =
        password ||
        (await this.backgroundApi.servicePassword.getCachedPassword());
      if (!password && isEnableTradingTrigger) {
        // eslint-disable-next-line no-param-reassign
        ({ password } =
          await this.backgroundApi.servicePassword.promptPasswordVerify());
      }

      if (password) {
        const userRole = await infoClient.userRole({
          user: accountAddress,
        });
        if (userRole.role === 'missing') {
          statusDetails.activatedOk = false;
          // await this.checkBuilderFeeStatus({
          //   accountAddress,
          //   isEnableTradingTrigger,
          //   statusDetails,
          // });
        } else {
          statusDetails.activatedOk = true;

          // TODO cache
          // Builder fee approve must be executed before agent setup
          await this.checkBuilderFeeStatus({
            accountAddress,
            isEnableTradingTrigger,
            statusDetails,
          });

          agentCredential = await this.checkAgentStatus({
            accountAddress,
            isEnableTradingTrigger,
            statusDetails,
            password,
          });

          if (agentCredential) {
            // TODO setupMasterWallet, setupAgentWallet
            await this.exchangeService.setup({
              userAddress: accountAddress,
              agentCredential,
            });

            void (async () => {
              const { referralCode } =
                await this.backgroundApi.simpleDb.perp.getPerpData();
              // referrer code can be approved by agent
              void this.exchangeService.setReferrerCode({
                code: referralCode || HYPERLIQUID_REFERRAL_CODE,
              });
            })();

            // referral code is optional, so we set it to true by default
            statusDetails.referralCodeOk = true;
          }
        }
      }
    } finally {
      status = {
        accountAddress: accountAddress || null,
        details: statusDetails,
      };
      await perpsActiveAccountStatusInfoAtom.set(status);

      clearTimeout(this.hideEnableTradingLoadingTimer);
      this.hideEnableTradingLoadingTimer = setTimeout(async () => {
        await perpsAccountLoadingInfoAtom.set(
          (prev): IPerpsAccountLoadingInfo => ({
            ...prev,
            enableTradingLoading: false,
          }),
        );
      }, 0);
    }
  }

  private async checkAgentStatus({
    accountAddress,
    isEnableTradingTrigger,
    statusDetails,
    password,
  }: {
    accountAddress: IHex;
    isEnableTradingTrigger: boolean;
    statusDetails: IPerpsActiveAccountStatusDetails;
    password: string;
  }) {
    const { infoClient } = hyperLiquidApiClients;

    let agentCredential: ICoreHyperLiquidAgentCredential | undefined;
    // TODO cache
    const extraAgents = await infoClient.extraAgents({
      user: accountAddress,
    });
    if (extraAgents?.length) {
      const now = Date.now();
      const validAgents = (
        await Promise.all(
          extraAgents.map(async (agent) => {
            const credential = await localDb.getHyperLiquidAgentCredential({
              userAddress: accountAddress,
              agentName: agent.name as EHyperLiquidAgentName,
              password,
            });
            if (
              agent.address &&
              agent.validUntil >
                now +
                  timerUtils.getTimeDurationMs({
                    day: 1,
                  }) &&
              credential?.agentAddress?.toLowerCase() ===
                agent.address.toLowerCase()
            ) {
              credential.validUntil = agent.validUntil;
              return credential;
            }
            return null;
          }),
        )
      )
        .filter(Boolean)
        .sort((a, b) => b.validUntil - a.validUntil);
      agentCredential = validAgents?.[0];
    }
    if (!agentCredential && isEnableTradingTrigger) {
      const privateKeyBytes = crypto.getRandomValues(new Uint8Array(32));
      const privateKeyHex = bufferUtils.bytesToHex(privateKeyBytes);
      const agentAddress = new ethers.Wallet(privateKeyHex).address as IHex;

      const availableNames = [
        EHyperLiquidAgentName.OneKeyAgent1,
        EHyperLiquidAgentName.OneKeyAgent2,
        EHyperLiquidAgentName.OneKeyAgent3,
      ];
      let agentNameToApprove: EHyperLiquidAgentName | undefined;
      if (extraAgents.length === 3) {
        const agentToRemove = extraAgents.sort(
          (a, b) => a.validUntil - b.validUntil,
        )?.[0];
        const agentNameToRemove = agentToRemove?.name as
          | EHyperLiquidAgentName
          | undefined;
        if (agentToRemove) {
          if (agentNameToRemove && availableNames.includes(agentNameToRemove)) {
            agentNameToApprove = agentNameToRemove;
          } else {
            const approveAgentResult = await this.exchangeService.removeAgent({
              agentName: agentNameToRemove,
            });
            console.log('approveAgentResult::', approveAgentResult);
            await timerUtils.wait(4000);

            // Poll to verify agent removal instead of fixed delay
            const pollStartTime = Date.now();
            const pollTimeoutMs = 10_000; // 10 seconds total polling timeout
            const requestTimeoutMs = 3000; // 3 seconds per request timeout

            while (Date.now() - pollStartTime < pollTimeoutMs) {
              try {
                const currentExtraAgents = await pTimeout(
                  infoClient.extraAgents({
                    user: accountAddress,
                  }),
                  {
                    milliseconds: requestTimeoutMs,
                  },
                );

                // Check if the agent was successfully removed
                if (
                  !currentExtraAgents.some(
                    (agent) => agent.name === agentNameToRemove,
                  )
                ) {
                  console.log('Agent removal confirmed:', agentNameToRemove);
                  break;
                }
              } catch (error) {
                console.log('Polling request failed:', error);
              }

              // Wait 500ms before next poll attempt
              await timerUtils.wait(500);
            }
          }
        }
      }
      if (!agentNameToApprove) {
        for (const agentName of availableNames) {
          if (!extraAgents.some((agent) => agent.name === agentName)) {
            agentNameToApprove = agentName;
            break;
          }
        }
      }
      if (!agentNameToApprove) {
        agentNameToApprove = EHyperLiquidAgentName.OneKeyAgent1;
      }

      const { agentTTL = HYPERLIQUID_AGENT_TTL_DEFAULT } =
        await this.backgroundApi.simpleDb.perp.getPerpData();

      const validUntil = Date.now() + agentTTL;
      // {name} valid_until 1765710491688
      const agentNameToApproveWithValidUntil = `${agentNameToApprove} valid_until ${validUntil}`;
      const approveAgentFn = () =>
        this.exchangeService.approveAgent({
          agent: agentAddress,
          agentName: agentNameToApproveWithValidUntil as EHyperLiquidAgentName,
          // agentName: EHyperLiquidAgentName.Official,
          authorize: true,
        });
      let retryTimes = 5;
      let approveAgentResult: IApiRequestResult | undefined;
      while (retryTimes >= 0) {
        try {
          retryTimes -= 1;
          approveAgentResult = await approveAgentFn();
          if (
            approveAgentResult &&
            approveAgentResult.status === 'ok' &&
            approveAgentResult.response.type === 'default'
          ) {
            break;
          }
        } catch (error) {
          const requestError = error as IApiRequestError | undefined;
          console.log('approveAgentError::', requestError);
          if (
            requestError?.response &&
            requestError?.response.status === 'err' &&
            requestError?.response.response === 'User has pending agent removal'
          ) {
            if (retryTimes <= 0) {
              throw error;
            }
          } else {
            throw error;
          }
        }
        await timerUtils.wait(500);
      }

      console.log('approveAgentResult::', approveAgentResult);
      if (
        approveAgentResult &&
        approveAgentResult.status === 'ok' &&
        approveAgentResult.response.type === 'default'
      ) {
        const encodedPrivateKey =
          await this.backgroundApi.servicePassword.encodeSensitiveText({
            text: privateKeyHex,
          });

        const { credentialId } =
          await this.backgroundApi.serviceAccount.addOrUpdateHyperLiquidAgentCredential(
            {
              userAddress: accountAddress,
              agentAddress,
              agentName: agentNameToApprove as EHyperLiquidAgentName,
              privateKey: encodedPrivateKey,
              validUntil,
            },
          );

        if (credentialId) {
          const credential = await localDb.getHyperLiquidAgentCredential({
            userAddress: accountAddress,
            agentName: agentNameToApprove as EHyperLiquidAgentName,
            password,
          });
          if (credential) {
            agentCredential = credential;
          }
        }
      }
    }
    if (agentCredential) {
      statusDetails.agentOk = true;
    }
    return agentCredential;
  }

  private async checkBuilderFeeStatus({
    accountAddress,
    isEnableTradingTrigger,
    statusDetails,
  }: {
    accountAddress: IHex;
    isEnableTradingTrigger: boolean;
    statusDetails: IPerpsActiveAccountStatusDetails;
  }) {
    const { expectBuilderAddress, expectMaxBuilderFee } =
      await this.getBuilderFeeConfig();

    if (expectBuilderAddress) {
      const maxBuilderFee = await this.getUserApprovedMaxBuilderFee({
        userAddress: accountAddress,
        builderAddress: expectBuilderAddress,
      });
      if (maxBuilderFee === expectMaxBuilderFee) {
        statusDetails.builderFeeOk = true;
      } else if (isEnableTradingTrigger) {
        const approveBuilderFeeResult =
          await this.exchangeService.approveBuilderFee({
            builder: expectBuilderAddress as IHex,
            maxFeeRate: `${new BigNumber(expectMaxBuilderFee)
              .div(1000)
              .toFixed()}%`,
          });
        if (
          approveBuilderFeeResult.status === 'ok' &&
          approveBuilderFeeResult.response.type === 'default'
        ) {
          statusDetails.builderFeeOk = true;
        }
        console.log('approveBuilderFeeResult::', approveBuilderFeeResult);
      }
    }
  }

  // TODO cache
  async getUserApprovedMaxBuilderFee({
    userAddress,
    builderAddress,
  }: {
    userAddress: string;
    builderAddress: string;
  }): Promise<IHyperliquidMaxBuilderFee> {
    const { infoClient } = hyperLiquidApiClients;
    return infoClient.maxBuilderFee({
      user: userAddress.toLowerCase() as IHex,
      builder: builderAddress.toLowerCase() as IHex,
    });
  }

  async getBuilderFeeConfig() {
    void this.updatePerpsConfigByServerWithCache();
    let {
      hyperliquidBuilderAddress: expectBuilderAddress,
      hyperliquidMaxBuilderFee: expectMaxBuilderFee,
    } = await this.backgroundApi.simpleDb.perp.getPerpData();
    if (!expectMaxBuilderFee || expectMaxBuilderFee < 0) {
      expectMaxBuilderFee = 0;
    }
    if (!expectBuilderAddress) {
      expectBuilderAddress = '';
    }
    return {
      expectBuilderAddress: expectBuilderAddress.toLowerCase(),
      expectMaxBuilderFee,
    };
  }

  async dispose(): Promise<void> {
    // Cleanup resources if needed
  }

  @backgroundMethod()
  async disposeExchangeClients() {
    await this.exchangeService.dispose();
    await perpsActiveAccountStatusInfoAtom.set({
      accountAddress: null,
      canTrade: false,
      details: {
        activatedOk: false,
        agentOk: false,
        builderFeeOk: false,
        referralCodeOk: false,
      },
    });
  }

  @backgroundMethod()
  async getTradingviewDisplayPriceScale(
    symbol: string,
  ): Promise<number | undefined> {
    return this.backgroundApi.simpleDb.perp.getTradingviewDisplayPriceScale(
      symbol,
    );
  }

  @backgroundMethod()
  async setTradingviewDisplayPriceScale({
    symbol,
    priceScale,
  }: {
    symbol: string;
    priceScale: number;
  }) {
    if (!symbol || priceScale === undefined || priceScale === null) {
      return;
    }
    const priceScaleBN = new BigNumber(priceScale);
    if (
      priceScaleBN.isNaN() ||
      priceScaleBN.isNegative() ||
      !priceScaleBN.isInteger()
    ) {
      return;
    }
    await this.backgroundApi.simpleDb.perp.updateTradingviewDisplayPriceScale({
      symbol,
      priceScale,
    });
  }
}
