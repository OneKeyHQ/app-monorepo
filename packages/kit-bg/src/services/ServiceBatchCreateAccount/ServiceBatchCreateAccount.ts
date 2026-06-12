import { HardwareErrorCode } from '@onekeyfe/hd-shared';
import {
  type ChainForFingerprint,
  type ICommonCallParams,
  ORPHAN_ELIGIBLE_ERROR_CODES,
  HardwareErrorCode as ThirdPartyHwErrorCode,
} from '@onekeyfe/hwk-adapter-core';
import { chunk, isNil, range, uniqBy } from 'lodash';

import { clearHdCredentialDecryptCache } from '@onekeyhq/core/src/secret';
import {
  backgroundClass,
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  IOneKeyError,
  IOneKeyHardwareErrorPayload,
} from '@onekeyhq/shared/src/errors/types/errorTypes';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import {
  convertDeviceError,
  convertDeviceResponse,
  isHardwareErrorByCode,
  isHardwareInterruptErrorByCode,
} from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import { convertThirdPartyDeviceError } from '@onekeyhq/shared/src/errors/utils/thirdPartyDeviceErrorUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { buildRequiredLedgerAppNamesForNetworks } from '@onekeyhq/shared/src/hardware/ledgerApps';
import { getVendorProfile } from '@onekeyhq/shared/src/hardware/vendorProfile';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IBatchCreateAccount } from '@onekeyhq/shared/types/account';
import {
  EHardwareCallContext,
  EHardwareVendor,
  type IDeviceCommonParams,
} from '@onekeyhq/shared/types/device';

import localDb from '../../dbs/local/localDb';
import { primeTransferAtom } from '../../states/jotai/atoms/prime';
import {
  isLedgerFingerprintChain,
  persistLedgerChainFingerprint,
} from '../../vaults/base/ledgerFingerprintUtils';
import { thirdPartyCommonCallParamsForCreateScene } from '../../vaults/base/thirdPartyHardwareCommonParams';
import { vaultFactory } from '../../vaults/factory';
import { getVaultSettings } from '../../vaults/settings';
import { buildDefaultAddAccountNetworks } from '../ServiceAccount/defaultNetworkAccountsConfig';
import ServiceBase from '../ServiceBase';
import { HardwareAllNetworkGetAddressResponse } from '../ServiceHardware/HardwareAllNetworkGetAddressResponse';

import { normalizeAllNetworkInstallCancelErrors } from './thirdPartyAllNetworkErrors';
import {
  type IThirdPartyAllNetworkAddressParams,
  attachLedgerAllNetworkFingerprints,
  normalizeThirdPartyAllNetworkBundle,
} from './thirdPartyAllNetworkParams';

import type { IPrimeTransferAtomData } from '../../states/jotai/atoms/prime';
import type {
  IAccountDeriveTypes,
  IHwAllNetworkPrepareAccountsItem,
  IHwAllNetworkPrepareAccountsResponse,
} from '../../vaults/types';
import type { IThirdPartyHardwareAdapter } from '../ServiceHardware/adapters/types';
import type { IWithHardwareProcessingControlParams } from '../ServiceHardwareUI/ServiceHardwareUI';
import type { AllNetworkAddressParams } from '@onekeyfe/hd-core';

export type IBatchCreateAccountProgressInfo = {
  totalCount: number;
  progressTotal: number;
  progressCurrent: number;
  createdCount: number;
};

type IPrimeTransferImportBatchCreateStageEvent = 'start' | 'done' | 'error';

type IPrimeTransferImportBatchCreateTraceParams = {
  event: IPrimeTransferImportBatchCreateStageEvent;
  stage: string;
  walletId?: string;
  networkId?: string;
  deriveType?: string;
  pathIndex?: number;
  indexes?: number[];
  networksCount?: number;
  customNetworksCount?: number;
  batchProgressCurrent?: number;
  batchProgressTotal?: number;
  batchCreatedCount?: number;
  batchTotalCount?: number;
  elapsedMs?: number;
  error?: string;
};

type IThirdPartyAllNetworkGetAddressHw = {
  allNetworkGetAddress?: (
    connectId: string,
    deviceId: string,
    params: ICommonCallParams & {
      bundle: IThirdPartyAllNetworkAddressParams[];
    },
  ) => Promise<
    | {
        success: true;
        payload: IHwAllNetworkPrepareAccountsItem[];
      }
    | {
        success: false;
        payload: {
          error: string;
          code: number;
          appName?: string;
          params?: IOneKeyHardwareErrorPayload['params'];
          _tag?: string;
        };
      }
  >;
};

type IThirdPartyAllNetworkGetAddressFn = NonNullable<
  IThirdPartyAllNetworkGetAddressHw['allNetworkGetAddress']
>;

export type IBatchBuildAccountsBaseParams = {
  walletId: string;
  networkId: string;
  deriveType: IAccountDeriveTypes;
  showUIProgress?: boolean;
  createAllDeriveTypes?: boolean;
  errorMessage?: string;
  customNetworks?: { networkId: string; deriveType: IAccountDeriveTypes }[];
  isAutoCreateMultiNetwork?: boolean;
} & IWithHardwareProcessingControlParams;
export type IBatchBuildAccountsParams = IBatchBuildAccountsBaseParams & {
  indexes: number[];
  excludedIndexes?: {
    [index: number]: true;
  };
  indexedAccountNames?: {
    [index: number]: string;
  };
  saveToDb?: boolean;
  saveToCache?: boolean;
  isVerifyAddressAction?: boolean;
  hwAllNetworkPrepareAccountsResponse:
    | IHwAllNetworkPrepareAccountsResponse
    | undefined;
  hwRootFingerprintInfo?: {
    rootFingerprint: number | undefined;
  };
  applyRestoreSyncPolicy?: boolean;
  hdCredentialCacheScopeId?: string;
};

export type IBatchBuildAccountsNormalFlowParams =
  IBatchBuildAccountsBaseParams & {
    indexes: number[];
    saveToDb: boolean;
    progressTotalCount?: number;
  };

type IAdvancedModeFlowParamsBase = {
  fromIndex: number;
  toIndex: number;
  excludedIndexes: {
    [index: number]: true;
  };
  indexedAccountNames?: {
    [index: number]: string;
  };
  saveToDb: boolean;
  progressTotalCount?: number;
  applyRestoreSyncPolicy?: boolean;
};
export type IBatchBuildAccountsAdvancedFlowParams =
  IBatchBuildAccountsBaseParams & IAdvancedModeFlowParamsBase;
export type IBatchBuildAccountsAdvancedFlowForAllNetworkParams = {
  includingDefaultNetworks?: boolean;
  isCreateWallet?: boolean;
  // Auto multi-network fill scene; flows to the keyring via ...params.
  isAutoCreateMultiNetwork?: boolean;
  walletId: string;
  customNetworks?: { networkId: string; deriveType: IAccountDeriveTypes }[];
  autoHandleExitError?: boolean;
  showUIProgress?: boolean;
} & IAdvancedModeFlowParamsBase &
  IWithHardwareProcessingControlParams;

@backgroundClass()
class ServiceBatchCreateAccount extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  private getErrorMessage(error: unknown) {
    return (error as Error)?.message || 'Unknown error';
  }

  private async recordPrimeTransferImportBatchCreateTrace(
    params: IPrimeTransferImportBatchCreateTraceParams,
  ) {
    const isInTransferImportOrBackupRestoreFlow: boolean =
      await this.backgroundApi.servicePrimeTransfer.isInTransferImportOrBackupRestoreFlow();
    if (!isInTransferImportOrBackupRestoreFlow) {
      return;
    }
    await this.backgroundApi.servicePrimeTransfer.recordImportBatchCreateTrace(
      params,
    );
  }

  private buildHdCredentialCacheScopeId({
    walletId,
    reason,
  }: {
    walletId: string | undefined;
    reason: string;
  }): string | undefined {
    if (!walletId || !accountUtils.isHdWallet({ walletId })) {
      return undefined;
    }
    return [
      reason,
      walletId,
      Date.now().toString(36),
      stringUtils.randomString(24),
    ].join(':');
  }

  private clearHdCredentialCacheScope({
    hdCredentialCacheScopeId,
  }: {
    hdCredentialCacheScopeId: string | undefined;
  }) {
    if (!hdCredentialCacheScopeId) {
      return;
    }
    void clearHdCredentialDecryptCache({
      hdCredentialCacheScopeId,
    }).catch((error) => {
      console.error(error);
    });
  }

  networkAccountsCache: Partial<{
    [key: string]: IBatchCreateAccount;
  }> = {};

  progressInfo: IBatchCreateAccountProgressInfo | undefined;

  isCreateFlowCancelled = false;

  buildNetworkAccountCacheKey({
    walletId,
    networkId,
    deriveType,
    index,
  }: IBatchBuildAccountsBaseParams & {
    index: number;
  }) {
    let networkIdOrImpl = networkId;
    const impl = networkUtils.getNetworkImpl({ networkId });
    if ([IMPL_EVM].includes(impl)) {
      networkIdOrImpl = impl;
    }

    return `${walletId}_${networkIdOrImpl}_${deriveType}_${index}`;
  }

  @backgroundMethod()
  async clearNetworkAccountCache() {
    this.networkAccountsCache = {};
  }

  beforeStartFlow() {
    this.isCreateFlowCancelled = false;
    this.progressInfo = undefined;
  }

  async updateAccountExistsInDb({ account }: { account: IBatchCreateAccount }) {
    if (await localDb.getAccountSafe({ accountId: account.id })) {
      account.existsInDb = true;
    } else {
      account.existsInDb = false;
    }
  }

  @backgroundMethod()
  async prepareBatchCreate() {
    await this.clearNetworkAccountCache();
  }

  @backgroundMethod()
  @toastIfError()
  async startBatchCreateAccountsFlow(
    payload:
      | {
          mode: 'advanced'; // range mode
          saveToCache?: boolean;
          params: IBatchBuildAccountsAdvancedFlowParams;
        }
      | {
          mode: 'normal'; // selected indexes mode
          saveToCache?: boolean;
          params: IBatchBuildAccountsNormalFlowParams;
        },
  ) {
    this.beforeStartFlow();

    let indexes: number[] = [];
    let excludedIndexes: {
      [index: number]: true;
    } = {};
    const saveToDb: boolean | undefined = payload.params.saveToDb;
    if (payload.mode === 'advanced') {
      indexes = await this.buildIndexesByFromAndTo({
        fromIndex: payload.params?.fromIndex,
        toIndex: payload.params?.toIndex,
      });
      excludedIndexes = payload.params.excludedIndexes;
    }
    if (payload.mode === 'normal') {
      indexes = payload.params.indexes;
    }

    const [deviceParams, vaultSettings] = await Promise.all([
      this.backgroundApi.serviceAccount.getWalletDeviceParams({
        walletId: payload.params.walletId,
        hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
      }),
      this.backgroundApi.serviceNetwork.getVaultSettings({
        networkId: payload.params.networkId,
      }),
    ]);
    const hwRootFingerprintInfo: {
      rootFingerprint: number | undefined;
    } = {
      rootFingerprint: undefined,
    };
    const hdCredentialCacheScopeId = this.buildHdCredentialCacheScopeId({
      walletId: payload.params.walletId,
      reason: 'startBatchCreateAccountsFlow',
    });

    let hwAllNetworkPrepareAccountsResponse:
      | IHwAllNetworkPrepareAccountsResponse
      | undefined;
    return this.backgroundApi.serviceHardwareUI.withHardwareProcessing(
      async () => {
        let customNetworks: {
          networkId: string;
          deriveType: IAccountDeriveTypes;
        }[] = [
          {
            networkId: payload.params.networkId,
            deriveType: payload.params.deriveType,
          },
        ];

        if (payload.params.customNetworks) {
          customNetworks = uniqBy(
            customNetworks.concat(payload.params.customNetworks),
            (item) => `${item.networkId}_${item.deriveType}`,
          );
        }

        if (
          payload.params.createAllDeriveTypes &&
          vaultSettings.mergeDeriveAssetsEnabled
        ) {
          const deriveInfoItems =
            await this.backgroundApi.serviceNetwork.getDeriveInfoItemsOfNetwork(
              {
                networkId: payload.params.networkId,
              },
            );
          customNetworks = deriveInfoItems.map((item) => ({
            networkId: payload.params.networkId,
            deriveType: item.value as IAccountDeriveTypes,
          }));
        }

        const networksParams =
          await this.buildBatchCreateAccountsNetworksParams({
            walletId: payload.params.walletId,
            customNetworks,
          });
        hwAllNetworkPrepareAccountsResponse =
          await this.getHwAllNetworkPrepareAccountsResponse({
            walletId: payload.params.walletId,
            hideCheckingDeviceLoading: payload.params.hideCheckingDeviceLoading,
            excludedIndexes,
            indexes,
            networksParams,
            saveToCache: payload.saveToCache,
            loopMode: true,
            isAutoCreateMultiNetwork: payload.params.isAutoCreateMultiNetwork,
          });
        this.progressInfo = this.buildProgressInfo({
          indexes,
          excludedIndexes,
          progressTotalCount: payload.params.progressTotalCount,
        });

        const result: {
          accountsForCreate: IBatchCreateAccount[];
        } = {
          accountsForCreate: [],
        };

        for (const networkParams of networksParams) {
          try {
            this.checkIfCancelled({
              saveToDb,
              showUIProgress: payload.params.showUIProgress,
              errorMessage: payload.params.errorMessage,
            });
            // TODO check if fingerprint is changed, if changed, exit flow with error
            const resp = await this.batchBuildAccounts({
              ...payload.params,
              ...networkParams,
              indexes,
              excludedIndexes,
              saveToDb,
              saveToCache: payload.saveToCache,
              hwAllNetworkPrepareAccountsResponse,
              hwRootFingerprintInfo,
              hdCredentialCacheScopeId,
            });
            result.accountsForCreate = result.accountsForCreate.concat(
              resp.accountsForCreate,
            );
          } catch (error: any) {
            this.forceExitFlowWhenErrorMatched({
              error,
              walletId: payload.params.walletId,
              saveToDb,
              showUIProgress: payload.params.showUIProgress,
            });
          }
        }

        await this.emitBatchCreateDoneEvents({
          saveToDb,
          showUIProgress: payload.params.showUIProgress,
        });
        // TODO move to UI
        // await this.backgroundApi.serviceHardware.cancelByWallet({
        //   walletId: payload?.params?.walletId,
        // });
        return result;
      },
      {
        deviceParams,
        hideCheckingDeviceLoading: payload.params.hideCheckingDeviceLoading,
        onFinally: () => {
          hwAllNetworkPrepareAccountsResponse?.destroy();
          this.clearHdCredentialCacheScope({ hdCredentialCacheScopeId });
        },
      },
    );
  }

  @backgroundMethod()
  @toastIfError()
  async previewBatchBuildAccounts({
    walletId,
    networkId,
    deriveType,
    indexes,
    showOnOneKey,
    saveToCache,
    isVerifyAddressAction,
  }: {
    walletId: string;
    networkId: string;
    deriveType: IAccountDeriveTypes;
    indexes: number[];
    showOnOneKey?: boolean;
    saveToCache?: boolean;
    isVerifyAddressAction?: boolean;
  }) {
    const deviceParams =
      await this.backgroundApi.serviceAccount.getWalletDeviceParams({
        walletId,
        hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
      });
    let hwAllNetworkPrepareAccountsResponse:
      | IHwAllNetworkPrepareAccountsResponse
      | undefined;
    const hdCredentialCacheScopeId = this.buildHdCredentialCacheScopeId({
      walletId,
      reason: 'previewBatchBuildAccounts',
    });

    const result =
      await this.backgroundApi.serviceHardwareUI.withHardwareProcessing(
        async () => {
          const networksParams =
            await this.buildBatchCreateAccountsNetworksParams({
              walletId,
              customNetworks: [
                {
                  networkId,
                  deriveType,
                },
              ],
            });
          hwAllNetworkPrepareAccountsResponse =
            await this.getHwAllNetworkPrepareAccountsResponse({
              walletId,
              hideCheckingDeviceLoading: false,
              skipCloseHardwareUiStateDialog: true,
              excludedIndexes: {},
              indexes,
              networksParams,
              showOnOneKey,
              saveToCache,
              isVerifyAddressAction,
              // skipDeviceCancel: true,
            });

          return this.batchBuildAccounts({
            walletId,
            networkId,
            deriveType,
            indexes,
            saveToDb: false,
            saveToCache,
            hwAllNetworkPrepareAccountsResponse,
            skipDeviceCancel: true,
            isVerifyAddressAction,
            hdCredentialCacheScopeId,
          });
        },
        {
          deviceParams,
          skipDeviceCancel: true,
          onFinally: () => {
            hwAllNetworkPrepareAccountsResponse?.destroy();
            this.clearHdCredentialCacheScope({ hdCredentialCacheScopeId });
          },
        },
      );

    await this.backgroundApi.serviceHardwareUI.closeHardwareUiStateDialog({
      walletId,
      connectId: undefined,
      skipDeviceCancel: !hwAllNetworkPrepareAccountsResponse,
      hardClose: true,
    });

    return result;
  }

  async buildDefaultNetworksForBatchCreate({
    walletId,
    isCreateWallet,
    customNetworks,
  }: {
    walletId: string;
    isCreateWallet?: boolean;
    customNetworks?: { networkId: string; deriveType: IAccountDeriveTypes }[];
  }): Promise<IBatchBuildAccountsBaseParams[]> {
    const networks = await buildDefaultAddAccountNetworks({
      backgroundApi: this.backgroundApi,
      walletId,
      includingNetworkWithGlobalDeriveType: true,
      firmwareType: undefined,
      isCreateWallet,
      customNetworks,
    });
    return networks.map((item) => ({
      ...item,
      walletId,
    }));
  }

  async buildAllNetworksForBatchCreate({
    walletId,
  }: {
    walletId: string;
  }): Promise<IBatchBuildAccountsBaseParams[]> {
    let excludeNetworkIds = [
      getNetworkIdsMap().onekeyall,
      getNetworkIdsMap().ada, // too slow
      getNetworkIdsMap().lightning, // network connection required
      getNetworkIdsMap().tlightning,
      getNetworkIdsMap().dnx, // not support hd
    ];
    if (accountUtils.isHwWallet({ walletId })) {
      excludeNetworkIds = [
        getNetworkIdsMap().onekeyall,
        getNetworkIdsMap().ada, // too slow, destroy hw passpharse
        getNetworkIdsMap().lightning, // sign required
        getNetworkIdsMap().tlightning,
      ];
    }

    const { networks } = await this.backgroundApi.serviceNetwork.getAllNetworks(
      {
        excludeTestNetwork: true,
        excludeNetworkIds,
        uniqByImpl: true,
      },
    );

    const result: IBatchBuildAccountsBaseParams[] = [];
    for (const network of networks) {
      const networkId = network.id;
      const deriveItems =
        await this.backgroundApi.serviceNetwork.getDeriveInfoItemsOfNetwork({
          networkId,
        });
      for (const deriveItem of deriveItems) {
        const deriveType: IAccountDeriveTypes =
          deriveItem.value as IAccountDeriveTypes;
        result.push({
          walletId,
          networkId,
          deriveType,
        });
      }
    }
    return result;
  }

  @backgroundMethod()
  @toastIfError()
  async addDefaultNetworkAccounts({
    walletId,
    indexedAccountId,
    indexes,
    skipDeviceCancel,
    hideCheckingDeviceLoading,
    skipCloseHardwareUiStateDialog,
    customNetworks,
    isCreateWallet,
    isAutoCreateMultiNetwork,
    autoHandleExitError = true,
  }: {
    autoHandleExitError?: boolean;
    walletId: string | undefined;
    indexedAccountId: string | undefined;
    indexes?: number[];
    customNetworks?: { networkId: string; deriveType: IAccountDeriveTypes }[];
    isCreateWallet?: boolean;
    // Auto multi-network fill scene; HW auto-install is derived from it.
    isAutoCreateMultiNetwork?: boolean;
  } & IWithHardwareProcessingControlParams): Promise<{
    addedAccounts: {
      networkId: string;
      deriveType: IAccountDeriveTypes;
    }[];
    failedAccounts: Array<{
      networkId: string;
      deriveType: IAccountDeriveTypes;
      error: IOneKeyError;
    }>;
  }> {
    defaultLogger.account.batchCreatePerf.addDefaultNetworkAccountsInService({
      walletId,
      indexedAccountId,
    });
    if (!walletId) {
      throw new OneKeyLocalError('walletId is required');
    }
    if (
      accountUtils.isHdWallet({
        walletId,
      }) ||
      accountUtils.isHwWallet({
        walletId,
      }) ||
      accountUtils.isQrWallet({
        walletId,
      })
    ) {
      let fromIndex: number;
      let toIndex: number;

      if (indexedAccountId) {
        const index = accountUtils.parseIndexedAccountId({
          indexedAccountId,
        }).index;
        fromIndex = index;
        toIndex = index;
      } else if (indexes && indexes.length > 0) {
        fromIndex = Math.min(...indexes);
        toIndex = Math.max(...indexes);
      } else {
        throw new OneKeyLocalError('indexedAccountId or indexes is required');
      }

      return this.startBatchCreateAccountsFlowForAllNetwork({
        walletId,
        fromIndex,
        toIndex,
        excludedIndexes: {},
        saveToDb: true,
        customNetworks: customNetworks || [],
        isCreateWallet,
        isAutoCreateMultiNetwork,
        autoHandleExitError: autoHandleExitError ?? true,
        skipDeviceCancel,
        hideCheckingDeviceLoading,
        skipCloseHardwareUiStateDialog,
      });
    }
    throw new OneKeyLocalError('addDefaultNetworkAccounts unknown error');
  }

  async buildBatchCreateAccountsNetworksParams(params: {
    walletId: string;
    includingDefaultNetworks?: boolean;
    isCreateWallet?: boolean;
    customNetworks:
      | { networkId: string; deriveType: IAccountDeriveTypes }[]
      | undefined;
  }) {
    let networksParams: IBatchBuildAccountsBaseParams[] = [];

    if (params.includingDefaultNetworks) {
      networksParams = networksParams.concat(
        await this.buildDefaultNetworksForBatchCreate({
          walletId: params.walletId,
          isCreateWallet: params.isCreateWallet,
          customNetworks: params.customNetworks,
        }),
      );

      //   await this.buildAllNetworksForBatchCreate({
      //     walletId: params.walletId,
      //   });
    }

    if (params.customNetworks?.length) {
      networksParams = networksParams.concat(
        params.customNetworks.map((item) => ({
          ...item,
          walletId: params.walletId,
        })),
      );
    }

    const networksParamsFiltered: IBatchBuildAccountsBaseParams[] = [];
    const evmNetworksMap: {
      [implDeriveTypeWalletId: string]: boolean;
    } = {};
    for (const p of networksParams) {
      const isEvm = networkUtils.isEvmNetwork({ networkId: p.networkId });
      if (isEvm) {
        const impl = networkUtils.getNetworkImpl({ networkId: p.networkId });
        const mapKey = `${impl}_${p.deriveType}_${p.walletId}`;
        if (evmNetworksMap[mapKey]) {
          // eslint-disable-next-line no-continue
          continue;
        }
        evmNetworksMap[mapKey] = true;
      }
      if (!networkUtils.isAllNetwork({ networkId: p.networkId })) {
        if (accountUtils.isQrWallet({ walletId: params.walletId })) {
          const settings = await getVaultSettings({ networkId: p.networkId });
          if (settings.qrAccountEnabled) {
            networksParamsFiltered.push(p);
          }
        } else {
          networksParamsFiltered.push(p);
        }
      }
    }
    networksParams = uniqBy(
      networksParamsFiltered,
      (p) => `${p.networkId}_${p.deriveType}_${p.walletId}`,
    );
    return networksParams;
  }

  @backgroundMethod()
  async buildRequiredLedgerAppsForDefaultNetworkAccounts(params: {
    walletId: string;
    customNetworks?: { networkId: string; deriveType: IAccountDeriveTypes }[];
    isCreateWallet?: boolean;
  }) {
    const networksParams = await this.buildBatchCreateAccountsNetworksParams({
      walletId: params.walletId,
      customNetworks: params.customNetworks || [],
      includingDefaultNetworks: true,
      isCreateWallet: params.isCreateWallet,
    });
    return buildRequiredLedgerAppNamesForNetworks(networksParams);
  }

  private async callThirdPartyAllNetworkGetAddress({
    allNetworkGetAddress,
    connectId,
    deviceId,
    dbDeviceId,
    commonParams,
    createSceneParams,
    bundleParams,
    vendorName,
    shouldPersistLedgerFingerprints,
  }: {
    allNetworkGetAddress: IThirdPartyAllNetworkGetAddressFn;
    connectId: string;
    deviceId: string;
    dbDeviceId?: string;
    commonParams?: IDeviceCommonParams;
    createSceneParams: { isAutoCreateMultiNetwork?: boolean };
    bundleParams: AllNetworkAddressParams[];
    vendorName: string;
    shouldPersistLedgerFingerprints?: boolean;
  }): Promise<IHwAllNetworkPrepareAccountsItem[]> {
    const bundle = normalizeThirdPartyAllNetworkBundle(bundleParams);
    const thirdPartyCommonParams =
      thirdPartyCommonCallParamsForCreateScene(createSceneParams);
    const response = await allNetworkGetAddress(connectId, deviceId, {
      ...commonParams,
      ...thirdPartyCommonParams,
      bundle,
    });

    if (!response.success) {
      throw convertThirdPartyDeviceError(response.payload, {
        vendor: vendorName,
      });
    }

    const payload = normalizeAllNetworkInstallCancelErrors(response.payload);

    if (shouldPersistLedgerFingerprints && dbDeviceId) {
      await this.persistLedgerAllNetworkFingerprints({
        dbDeviceId,
        items: payload,
      });
    }

    return payload;
  }

  private async persistLedgerAllNetworkFingerprints({
    dbDeviceId,
    items,
  }: {
    dbDeviceId: string;
    items: IHwAllNetworkPrepareAccountsItem[];
  }) {
    const persisted = new Set<ChainForFingerprint>();
    for (const item of items) {
      if (item.success) {
        const fingerprint = item.payload?.chainFingerprint;
        const chain = item.payload?.chainFingerprintChain;
        if (
          typeof fingerprint === 'string' &&
          fingerprint &&
          isLedgerFingerprintChain(chain) &&
          !persisted.has(chain)
        ) {
          await persistLedgerChainFingerprint({
            dbDeviceId,
            chain,
            fingerprint,
          });
          persisted.add(chain);
        }
      }
    }
  }

  async getHwAllNetworkPrepareAccountsResponse(params: {
    walletId: string;
    hideCheckingDeviceLoading: boolean | undefined;
    skipCloseHardwareUiStateDialog?: boolean;
    excludedIndexes:
      | {
          [index: number]: true;
        }
      | undefined;
    indexes: number[];
    networksParams: IBatchBuildAccountsBaseParams[];
    showOnOneKey?: boolean;
    saveToCache?: boolean;
    loopMode?: boolean;
    isAutoCreateMultiNetwork?: boolean;
    isVerifyAddressAction?: boolean;
  }): Promise<IHwAllNetworkPrepareAccountsResponse | undefined> {
    const hwAllNetworkPrepareAccountsResponse =
      new HardwareAllNetworkGetAddressResponse();

    // call hw all network api for faster
    if (accountUtils.isHwWallet({ walletId: params.walletId })) {
      const { networksParams, skipCloseHardwareUiStateDialog } = params;
      const excludedIndexes = params.excludedIndexes;

      defaultLogger.hardware.sdkLog.consoleLog(
        'call getHwAllNetworkPrepareAccountsResponse',
      );
      const hideCheckingDeviceLoading = params.hideCheckingDeviceLoading;
      const deviceParams =
        await this.backgroundApi.serviceAccount.getWalletDeviceParams({
          walletId: params.walletId,
          hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
        });
      const deviceVendor = deviceParams?.dbDevice?.vendor;
      const vendorProfile = getVendorProfile(deviceVendor);
      const isThirdPartyWallet = !!deviceVendor && vendorProfile.isThirdParty;
      let thirdPartyAllNetworkAdapter: IThirdPartyHardwareAdapter | undefined;
      let thirdPartyHw: IThirdPartyAllNetworkGetAddressHw | undefined;
      if (isThirdPartyWallet) {
        if (params.isVerifyAddressAction) {
          return undefined;
        }
        const adapter =
          await this.backgroundApi.serviceHardware.getAdapterForVendor(
            deviceVendor,
          );
        if (!adapter?.supportsAllNetworkGetAddress) {
          return undefined;
        }
        thirdPartyHw = adapter.hw as IThirdPartyAllNetworkGetAddressHw;
        if (!thirdPartyHw.allNetworkGetAddress) {
          return undefined;
        }
        thirdPartyAllNetworkAdapter = adapter;
      }

      await this.backgroundApi.serviceHardwareUI.withHardwareProcessing(
        async () => {
          const bundleParams: AllNetworkAddressParams[] = [];
          for (const networkParams of networksParams) {
            const deriveInfo =
              await this.backgroundApi.serviceNetwork.getDeriveInfoOfNetwork({
                networkId: networkParams.networkId,
                deriveType: networkParams.deriveType,
              });
            // number from fromIndex to toIndex
            for (const i of params.indexes) {
              const key = this.buildNetworkAccountCacheKey({
                walletId: params.walletId,
                networkId: networkParams.networkId,
                deriveType: networkParams.deriveType,
                index: i,
              });
              const cacheAccount = this.networkAccountsCache[key];
              if (
                !excludedIndexes?.[i] &&
                (!cacheAccount || !params.saveToCache)
              ) {
                const path = accountUtils.buildPathFromTemplate({
                  template: deriveInfo.template,
                  index: i,
                });
                const vault = await vaultFactory.getWalletOnlyVault({
                  networkId: networkParams.networkId,
                  walletId: params.walletId,
                });
                let allNetworkPrepareParam: AllNetworkAddressParams | undefined;
                try {
                  allNetworkPrepareParam =
                    await vault.keyring.buildHwAllNetworkPrepareAccountsParams({
                      path,
                      template: deriveInfo.template,
                      index: i,
                      addressEncoding: deriveInfo.addressEncoding,
                    });
                } catch (error) {
                  const plainError = errorUtils.toPlainErrorObject(error);
                  if (
                    !thirdPartyAllNetworkAdapter ||
                    plainError.code !== ThirdPartyHwErrorCode.ChainNotSupported
                  ) {
                    throw error;
                  }
                }
                if (allNetworkPrepareParam) {
                  allNetworkPrepareParam.showOnOneKey =
                    params.showOnOneKey ?? allNetworkPrepareParam.showOnOneKey;
                  bundleParams.push(allNetworkPrepareParam);
                }
              }
            }
          }
          if (bundleParams.length && deviceParams?.dbDevice) {
            if (
              thirdPartyAllNetworkAdapter?.vendor === EHardwareVendor.ledger
            ) {
              attachLedgerAllNetworkFingerprints({
                bundle: bundleParams,
                settingsRaw: deviceParams.dbDevice.settingsRaw,
              });
            }
            hwAllNetworkPrepareAccountsResponse.bundleLength =
              bundleParams.length;

            // throw new NewFirmwareForceUpdate({ payload: {} });

            appEventBus.emit(
              EAppEventBusNames.SDKGetAllNetworkAddressesStart,
              undefined,
            );

            let allNetworkGetAddressResponse: IHwAllNetworkPrepareAccountsItem[] =
              [];
            try {
              const thirdPartyAllNetworkGetAddress =
                thirdPartyHw?.allNetworkGetAddress;
              if (
                thirdPartyAllNetworkAdapter &&
                thirdPartyAllNetworkGetAddress
              ) {
                allNetworkGetAddressResponse =
                  await this.callThirdPartyAllNetworkGetAddress({
                    allNetworkGetAddress: thirdPartyAllNetworkGetAddress,
                    connectId: deviceParams.dbDevice.connectId,
                    deviceId: deviceParams.dbDevice.deviceId || '',
                    dbDeviceId: deviceParams.dbDevice.id,
                    commonParams: deviceParams.deviceCommonParams,
                    createSceneParams: params,
                    bundleParams,
                    vendorName:
                      vendorProfile.defaultDeviceName ||
                      thirdPartyAllNetworkAdapter.vendor,
                    shouldPersistLedgerFingerprints:
                      thirdPartyAllNetworkAdapter.vendor ===
                      EHardwareVendor.ledger,
                  });
              }

              if (
                !thirdPartyAllNetworkAdapter ||
                !thirdPartyAllNetworkGetAddress
              ) {
                const sdk =
                  await this.backgroundApi.serviceHardware.getSDKInstance({
                    connectId: deviceParams.dbDevice?.connectId,
                  });
                const compatibleConnectId =
                  await this.backgroundApi.serviceHardware.getCompatibleConnectId(
                    {
                      connectId: deviceParams.dbDevice?.connectId || '',
                      featuresDeviceId: deviceParams.dbDevice?.deviceId || '',
                      hardwareCallContext:
                        EHardwareCallContext.USER_INTERACTION,
                    },
                  );

                allNetworkGetAddressResponse = (await convertDeviceResponse(
                  async () => {
                    const sdkPromiseResult =
                      params.loopMode && !platformEnv.isExtension
                        ? sdk.allNetworkGetAddressByLoop(
                            compatibleConnectId,
                            deviceParams.dbDevice?.deviceId || '',
                            {
                              ...deviceParams.deviceCommonParams,
                              bundle: bundleParams,
                              onLoopItemResponse: (data) => {
                                if (hideCheckingDeviceLoading) {
                                  void this.backgroundApi.serviceHardwareUI.closeHardwareUiStateDialog(
                                    {
                                      connectId: compatibleConnectId,
                                    },
                                  );
                                }
                                if (data) {
                                  hwAllNetworkPrepareAccountsResponse.onSdkItemCallResponse(
                                    data as IHwAllNetworkPrepareAccountsItem,
                                  );
                                }
                              },
                              onAllItemsResponse: (data, error) => {
                                if (data === undefined && error) {
                                  const hwError = convertDeviceError(
                                    {
                                      code: error.payload?.code,
                                      error: error.payload?.error,
                                    },
                                    {},
                                  );
                                  hwAllNetworkPrepareAccountsResponse.rejectAllResponse(
                                    hwError ||
                                      new OneKeyLocalError(
                                        'Device communication interrupted, please try again later (386147)',
                                      ),
                                  );
                                }
                                appEventBus.emit(
                                  EAppEventBusNames.SDKGetAllNetworkAddressesEnd,
                                  undefined,
                                );
                              },
                            },
                          )
                        : sdk.allNetworkGetAddress(
                            compatibleConnectId,
                            deviceParams.dbDevice?.deviceId || '',
                            {
                              ...deviceParams.deviceCommonParams,
                              bundle: bundleParams,
                            },
                          );

                    const sdkAllNetworkGetAddressResponse =
                      await sdkPromiseResult;

                    return sdkAllNetworkGetAddressResponse;
                  },
                )) as IHwAllNetworkPrepareAccountsItem[];
              }
              allNetworkGetAddressResponse =
                normalizeAllNetworkInstallCancelErrors(
                  allNetworkGetAddressResponse,
                );
            } catch (error) {
              if (params.loopMode) {
                appEventBus.emit(
                  EAppEventBusNames.SDKGetAllNetworkAddressesEnd,
                  undefined,
                );
              }
              throw error;
            } finally {
              if (!params.loopMode) {
                appEventBus.emit(
                  EAppEventBusNames.SDKGetAllNetworkAddressesEnd,
                  undefined,
                );
              }
            }

            setTimeout(() => {
              const resolveSdkGetAllAddressResponse = () => {
                for (const item of allNetworkGetAddressResponse) {
                  hwAllNetworkPrepareAccountsResponse.onSdkItemCallResponse(
                    item,
                  );
                }
              };

              resolveSdkGetAllAddressResponse();

              if (process.env.NODE_ENV !== 'production') {
                // resolve by console call manually:
                //      window.$$resolveSdkGetAllAddressResponse()
                // @ts-ignore
                globalThis.$$resolveSdkGetAllAddressResponse =
                  resolveSdkGetAllAddressResponse;
              }
            }, 0);
          }
        },
        {
          deviceParams,
          skipDeviceCancel: true,
          skipDeviceCancelAtFirst: true,
          skipCloseHardwareUiStateDialog:
            skipCloseHardwareUiStateDialog ?? false,
          hideCheckingDeviceLoading,
        },
      );
    }

    return hwAllNetworkPrepareAccountsResponse;
  }

  // TODO call batch create even if single network single address
  @backgroundMethod()
  @toastIfError()
  async startBatchCreateAccountsFlowForAllNetwork(
    params: IBatchBuildAccountsAdvancedFlowForAllNetworkParams,
  ): Promise<{
    addedAccounts: {
      networkId: string;
      deriveType: IAccountDeriveTypes;
    }[];
    failedAccounts: {
      networkId: string;
      deriveType: IAccountDeriveTypes;
      error: IOneKeyError;
    }[];
  }> {
    this.beforeStartFlow();

    const deviceParams =
      await this.backgroundApi.serviceAccount.getWalletDeviceParams({
        walletId: params.walletId,
        hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
      });
    let hwAllNetworkPrepareAccountsResponse:
      | IHwAllNetworkPrepareAccountsResponse
      | undefined;
    const hdCredentialCacheScopeId = this.buildHdCredentialCacheScopeId({
      walletId: params.walletId,
      reason: 'startBatchCreateAccountsFlowForAllNetwork',
    });

    return this.backgroundApi.serviceHardwareUI.withHardwareProcessing(
      async () => {
        const networksParams: IBatchBuildAccountsBaseParams[] =
          await this.buildBatchCreateAccountsNetworksParams({
            walletId: params.walletId,
            customNetworks: params.customNetworks,
            includingDefaultNetworks: params.includingDefaultNetworks ?? true,
            isCreateWallet: params.isCreateWallet,
          });
        await this.recordPrimeTransferImportBatchCreateTrace({
          event: 'done',
          stage: 'buildBatchCreateAccountsNetworksParams',
          walletId: params.walletId,
          networksCount: networksParams.length,
          customNetworksCount: params.customNetworks?.length || 0,
        });

        const { saveToDb } = params;
        const indexes = await this.buildIndexesByFromAndTo({
          fromIndex: params?.fromIndex,
          toIndex: params?.toIndex,
        });
        const excludedIndexes = params.excludedIndexes;

        const progressInfo = this.buildProgressInfo({
          indexes,
          excludedIndexes,
        });
        progressInfo.totalCount *= networksParams.length;
        progressInfo.progressTotal *= networksParams.length;
        this.progressInfo = progressInfo;

        const addedAccounts: Array<{
          networkId: string;
          deriveType: IAccountDeriveTypes;
        }> = [];

        const failedAccounts: Array<{
          networkId: string;
          deriveType: IAccountDeriveTypes;
          error: IOneKeyError;
        }> = [];
        const prepareAllNetworkStartedAt = Date.now();
        await this.recordPrimeTransferImportBatchCreateTrace({
          event: 'start',
          stage: 'getHwAllNetworkPrepareAccountsResponse',
          walletId: params.walletId,
          networksCount: networksParams.length,
        });
        hwAllNetworkPrepareAccountsResponse =
          await this.getHwAllNetworkPrepareAccountsResponse({
            walletId: params.walletId,
            hideCheckingDeviceLoading: params.hideCheckingDeviceLoading,
            excludedIndexes,
            indexes,
            networksParams,
            isAutoCreateMultiNetwork: params.isAutoCreateMultiNetwork,
          });
        await this.recordPrimeTransferImportBatchCreateTrace({
          event: 'done',
          stage: 'getHwAllNetworkPrepareAccountsResponse',
          walletId: params.walletId,
          networksCount: networksParams.length,
          elapsedMs: Date.now() - prepareAllNetworkStartedAt,
        });

        for (const networkParams of networksParams) {
          const batchBuildNetworkStartedAt = Date.now();
          try {
            this.checkIfCancelled({
              saveToDb,
            });
            await this.recordPrimeTransferImportBatchCreateTrace({
              event: 'start',
              stage: 'batchBuildAccountsForNetwork',
              walletId: params.walletId,
              networkId: networkParams.networkId,
              deriveType: networkParams.deriveType,
            });

            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { accountsForCreate } = await this.batchBuildAccounts({
              ...params,
              ...networkParams,
              showUIProgress:
                params.showUIProgress || networkParams.showUIProgress,
              indexes,
              excludedIndexes,
              saveToDb: true,
              hwAllNetworkPrepareAccountsResponse,
              indexedAccountNames: params.indexedAccountNames,
              hdCredentialCacheScopeId,
              // isAutoCreateMultiNetwork flows from ...params.
            });
            addedAccounts.push({
              networkId: networkParams.networkId,
              deriveType: networkParams.deriveType,
            });
            await this.recordPrimeTransferImportBatchCreateTrace({
              event: 'done',
              stage: 'batchBuildAccountsForNetwork',
              walletId: params.walletId,
              networkId: networkParams.networkId,
              deriveType: networkParams.deriveType,
              elapsedMs: Date.now() - batchBuildNetworkStartedAt,
            });
          } catch (error: any) {
            await this.recordPrimeTransferImportBatchCreateTrace({
              event: 'error',
              stage: 'batchBuildAccountsForNetwork',
              walletId: params.walletId,
              networkId: networkParams.networkId,
              deriveType: networkParams.deriveType,
              elapsedMs: Date.now() - batchBuildNetworkStartedAt,
              error: this.getErrorMessage(error),
            });
            this.forceExitFlowWhenErrorMatched({
              error,
              walletId: params.walletId,
              saveToDb,
              autoHandleExitError: params.autoHandleExitError,
            });
            const plainError = errorUtils.toPlainErrorObject(error);
            failedAccounts.push({
              networkId: networkParams.networkId,
              deriveType: networkParams.deriveType,
              error: plainError,
            });
          }
        }

        defaultLogger.account.batchCreatePerf.emitBatchCreateDoneEvents({
          walletId: params.walletId,
        });
        await this.emitBatchCreateDoneEvents({
          saveToDb,
          showUIProgress: false,
        });

        defaultLogger.account.batchCreatePerf.batchCreateForAllNetworkDone({
          walletId: params.walletId,
          addedAccountsCount: addedAccounts.length,
        });
        return { addedAccounts, failedAccounts };
      },
      {
        deviceParams,
        skipDeviceCancel: params.skipDeviceCancel,
        hideCheckingDeviceLoading: params.hideCheckingDeviceLoading,
        onFinally: () => {
          hwAllNetworkPrepareAccountsResponse?.destroy();
          this.clearHdCredentialCacheScope({ hdCredentialCacheScopeId });
        },
      },
    );
  }

  forceExitFlowWhenErrorMatched({
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    walletId,
    error,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    saveToDb,
    autoHandleExitError,
    showUIProgress,
  }: {
    walletId: string;
    error: any;
    saveToDb: boolean | undefined;
    autoHandleExitError?: boolean;
    showUIProgress?: boolean;
  }) {
    if (this.progressInfo && showUIProgress) {
      appEventBus.emit(EAppEventBusNames.BatchCreateAccount, {
        totalCount: this.progressInfo.totalCount,
        createdCount: this.progressInfo.createdCount,
        progressTotal: this.progressInfo.progressTotal,
        progressCurrent: this.progressInfo.progressCurrent,
        error: errorUtils.toPlainErrorObject(error),
      });
    }

    if (!autoHandleExitError) {
      // always exit flow if any error,
      throw error;
    }

    // batch create flow cancelled
    if (this.isCreateFlowCancelled || !this.progressInfo) {
      throw error;
    }

    // batch create address preview mode
    if (!saveToDb) {
      throw error;
    }

    // **** hardware terminated errors ****
    // Some high priority errors need to interrupt the process
    if (accountUtils.isHwWallet({ walletId })) {
      if (isHardwareInterruptErrorByCode({ error })) {
        throw error;
      }
      // Unplug device?
      if (
        isHardwareErrorByCode({
          error,
          code: [
            // OneKey HW (legacy enum)
            HardwareErrorCode.DeviceNotFound,
            HardwareErrorCode.PinCancelled,
            HardwareErrorCode.ActionCancelled,
            HardwareErrorCode.CallQueueActionCancelled,
            HardwareErrorCode.DeviceInterruptedFromOutside,
            HardwareErrorCode.DeviceInterruptedFromUser,
            // Third-party HW batch-abort codes from SDK.
            ...ORPHAN_ELIGIBLE_ERROR_CODES,
          ],
        })
      ) {
        throw error;
      }
    }
    // **** password cancel
    if (
      errorUtils.isErrorByClassName({
        error,
        className: [
          EOneKeyErrorClassNames.PasswordPromptDialogCancel,
          EOneKeyErrorClassNames.SecureQRCodeDialogCancel,
          EOneKeyErrorClassNames.OneKeyErrorScanQrCodeCancel,
        ],
      })
    ) {
      throw error;
    }
  }

  async shouldEmitAccountUpdateEvent(): Promise<boolean> {
    const isInTransferImportOrBackupRestoreFlow: boolean =
      await this.backgroundApi.servicePrimeTransfer.isInTransferImportOrBackupRestoreFlow();
    if (isInTransferImportOrBackupRestoreFlow) {
      return false;
    }
    return true;
  }

  async emitBatchCreateDoneEvents({
    saveToDb,
    showUIProgress,
  }: {
    saveToDb?: boolean;
    showUIProgress?: boolean;
  } = {}) {
    const shouldEmitEvent = await this.shouldEmitAccountUpdateEvent();

    if (saveToDb) {
      if (shouldEmitEvent) {
        appEventBus.emit(EAppEventBusNames.AccountUpdate, undefined);
      }
    }
    if (this.progressInfo && showUIProgress) {
      appEventBus.emit(EAppEventBusNames.BatchCreateAccount, {
        totalCount: this.progressInfo.totalCount,
        createdCount: this.progressInfo.createdCount,
        progressTotal: this.progressInfo.progressTotal,
        progressCurrent: this.progressInfo.progressTotal,
      });

      await timerUtils.wait(600);
    }
  }

  @backgroundMethod()
  async cancelBatchCreateAccountsFlow() {
    this.isCreateFlowCancelled = true;
    this.progressInfo = undefined;
  }

  checkIfCancelled({
    saveToDb,
    showUIProgress,
    errorMessage,
  }: {
    saveToDb: boolean | undefined;
    showUIProgress?: boolean;
    errorMessage?: string;
  }) {
    if ((saveToDb || showUIProgress) && this.isCreateFlowCancelled) {
      throw new OneKeyLocalError(
        errorMessage ||
          appLocale.intl.formatMessage({
            id: ETranslations.global_bulk_accounts_loading_error,
          }),
      );
    }
  }

  @backgroundMethod()
  async buildIndexesByFromAndTo({
    fromIndex,
    toIndex,
    indexes,
  }: {
    fromIndex?: number;
    toIndex?: number;
    indexes?: number[];
  }) {
    if (!indexes) {
      if (isNil(fromIndex)) {
        throw new OneKeyLocalError('fromIndex is required');
      }
      if (isNil(toIndex)) {
        throw new OneKeyLocalError('toIndex is required');
      }
      // eslint-disable-next-line no-param-reassign
      indexes = range(fromIndex, toIndex + 1);
    }
    if (!indexes || !indexes?.length) {
      throw new OneKeyLocalError('indexes is required');
    }
    return indexes;
  }

  buildProgressInfo({
    indexes,
    excludedIndexes,
    progressTotalCount,
  }: {
    indexes: number[];
    excludedIndexes?: {
      [index: number]: true;
    };
    progressTotalCount?: number;
  }): IBatchCreateAccountProgressInfo {
    const totalCount = indexes.length;
    const progressTotal =
      progressTotalCount ??
      totalCount - Object.values(excludedIndexes || {}).filter(Boolean).length;
    const progressCurrent = 0;
    const createdCount = 0;
    return {
      totalCount,
      progressTotal,
      progressCurrent,
      createdCount,
    };
  }

  @backgroundMethod()
  @toastIfError()
  async batchBuildAccounts({
    walletId,
    networkId,
    deriveType,
    indexes,
    excludedIndexes,
    saveToDb,
    saveToCache,
    hideCheckingDeviceLoading,
    skipCloseHardwareUiStateDialog,
    showUIProgress,
    hwAllNetworkPrepareAccountsResponse,
    isVerifyAddressAction,
    errorMessage,
    indexedAccountNames,
    hwRootFingerprintInfo,
    applyRestoreSyncPolicy,
    hdCredentialCacheScopeId,
    isAutoCreateMultiNetwork,
  }: IBatchBuildAccountsParams): Promise<{
    accountsForCreate: IBatchCreateAccount[];
  }> {
    defaultLogger.account.batchCreatePerf.batchBuildAccountsStart({
      walletId,
      networkId,
      deriveType,
      indexes,
      excludedIndexes,
      saveToDb,
      hwAllNetworkPrepareAccountsResponse,
      isVerifyAddressAction,
    });
    if (networkUtils.isAllNetwork({ networkId })) {
      throw new OneKeyLocalError(
        'Batch Create Accounts ERROR:  All network not support',
      );
    }
    if (!this.progressInfo && saveToDb) {
      throw new OneKeyLocalError(
        'Batch Create Accounts ERROR:  progressInfo is required',
      );
    }

    const accountsForCreate: IBatchCreateAccount[] = [];

    const indexesForRebuild: number[] = [];

    const processAccountForCreateFn = async ({
      key,
      accountForCreate,
    }: {
      key: string;
      accountForCreate: IBatchCreateAccount;
    }) => {
      if (
        accountUtils.isHwWallet({
          walletId,
        }) &&
        !accountUtils.isQrWallet({
          walletId,
        })
      ) {
        if (!accountForCreate?.__hwExtraInfo__) {
          // void this.backgroundApi.serviceApp.showToast({
          //   message:
          //     'batchBuildAccounts ERROR: accountForCreate.__hwExtraInfo__ is required',
          //   method: 'error',
          //   title: 'Error',
          // });
          console.error(
            'batchBuildAccounts ERROR: accountForCreate.__hwExtraInfo__ is required',
            {
              accountForCreate,
              networkId,
              deriveType,
              indexes,
            },
          );
          // TODO custom Error for: forceExitFlowWhenErrorMatched
          throw new OneKeyLocalError(
            'batchBuildAccounts ERROR: accountForCreate.__hwExtraInfo__ is required',
          );
        }
        if (
          hwRootFingerprintInfo &&
          isNil(hwRootFingerprintInfo.rootFingerprint)
        ) {
          hwRootFingerprintInfo.rootFingerprint =
            accountForCreate.__hwExtraInfo__.rootFingerprint;
        }
        if (
          hwRootFingerprintInfo &&
          !isNil(hwRootFingerprintInfo?.rootFingerprint) &&
          accountForCreate.__hwExtraInfo__.rootFingerprint !==
            hwRootFingerprintInfo?.rootFingerprint
        ) {
          throw new OneKeyLocalError(
            'Device communication interrupted, please try again later (988251)',
          );
        }
      }
      this.checkIfCancelled({ saveToDb, showUIProgress, errorMessage });
      await this.updateAccountExistsInDb({ account: accountForCreate });
      if (saveToCache) {
        this.networkAccountsCache[key] = accountForCreate;
      }
      accountsForCreate.push(accountForCreate);
      if (saveToDb) {
        if (!accountForCreate.existsInDb) {
          this.checkIfCancelled({ saveToDb, showUIProgress, errorMessage });
          const shouldEmitEvent = await this.shouldEmitAccountUpdateEvent();
          await this.backgroundApi.serviceAccount.addBatchCreatedHdOrHwAccount({
            walletId,
            networkId,
            account: accountForCreate,
            indexedAccountNames,
            skipEventEmit: !shouldEmitEvent,
            applyRestoreSyncPolicy,
          });
          if (this.progressInfo) {
            this.progressInfo.createdCount += 1;
          }
        }
      }
      if (this.progressInfo) {
        this.progressInfo.progressCurrent += 1;
        if (showUIProgress) {
          appEventBus.emit(EAppEventBusNames.BatchCreateAccount, {
            totalCount: this.progressInfo.totalCount,
            createdCount: this.progressInfo.createdCount,
            progressTotal: this.progressInfo.progressTotal,
            progressCurrent: this.progressInfo.progressCurrent,
            networkId,
            deriveType,
          });

          await timerUtils.wait(100); // wait for UI refresh
        }
      }
    };

    // for loop indexes
    for (const index of indexes) {
      try {
        this.checkIfCancelled({ saveToDb, showUIProgress, errorMessage });
        if (excludedIndexes?.[index] === true) {
          // eslint-disable-next-line no-continue
          continue;
        }
        const key = this.buildNetworkAccountCacheKey({
          walletId,
          networkId,
          deriveType,
          index,
        });
        const cacheAccount = this.networkAccountsCache[key];
        if (cacheAccount && saveToCache) {
          this.checkIfCancelled({ saveToDb, showUIProgress, errorMessage });
          await processAccountForCreateFn({
            key,
            accountForCreate: cacheAccount,
          });
        } else {
          indexesForRebuild.push(index);
        }
      } catch (error) {
        this.forceExitFlowWhenErrorMatched({
          error,
          walletId,
          saveToDb,
          showUIProgress,
        });
      }
    }

    if (indexesForRebuild.length) {
      // Hardware supports creating up to 10 addresses at a time, so we need to create them in batches here
      // const indexesChunks = chunk(indexesForRebuild, 10);
      const indexesChunks = chunk(indexesForRebuild, 1);
      for (let i = 0; i < indexesChunks.length; i += 1) {
        const indexesForRebuildChunk = indexesChunks[i];
        try {
          this.checkIfCancelled({ saveToDb, showUIProgress, errorMessage });
          defaultLogger.account.batchCreatePerf.prepareHdOrHwAccounts();
          const pathIndex =
            indexesForRebuildChunk.length === 1
              ? indexesForRebuildChunk[0]
              : undefined;

          await primeTransferAtom.set(
            (prev): IPrimeTransferAtomData => ({
              ...prev,
              importCurrentCreatingTarget: [
                walletId,
                indexesForRebuildChunk.join(','),
                networkId,
                deriveType === 'default' ? '' : deriveType,
              ]
                .filter(Boolean)
                .join('__'),
            }),
          );

          const prepareAccountsStartedAt = Date.now();
          await this.recordPrimeTransferImportBatchCreateTrace({
            event: 'start',
            stage: 'prepareHdOrHwAccounts',
            walletId,
            networkId,
            deriveType,
            pathIndex,
            indexes: indexesForRebuildChunk,
          });
          const { vault, accounts } =
            await this.backgroundApi.serviceAccount.prepareHdOrHwAccounts({
              walletId,
              networkId,
              deriveType,
              indexes: indexesForRebuildChunk,
              indexedAccountId: undefined,
              isVerifyAddressAction,
              skipDeviceCancel: true, // always skip cancel for batch create
              skipCloseHardwareUiStateDialog,
              skipDeviceCancelAtFirst: true,
              skipWaitingAnimationAtFirst: true,
              hideCheckingDeviceLoading,
              hwAllNetworkPrepareAccountsResponse,
              hdCredentialCacheScopeId,
              isAutoCreateMultiNetwork,
            });
          await this.recordPrimeTransferImportBatchCreateTrace({
            event: 'done',
            stage: 'prepareHdOrHwAccounts',
            walletId,
            networkId,
            deriveType,
            pathIndex,
            indexes: indexesForRebuildChunk,
            elapsedMs: Date.now() - prepareAccountsStartedAt,
          });

          // if (i !== indexesChunks.length - 1) {
          //   await timerUtils.wait(300);
          // }

          defaultLogger.account.batchCreatePerf.prepareHdOrHwAccountsDone();

          const networkInfo = await vault.getNetworkInfo();
          for (const account of accounts) {
            try {
              this.checkIfCancelled({ saveToDb, showUIProgress, errorMessage });
              if (isNil(account.pathIndex)) {
                throw new OneKeyLocalError(
                  'batchBuildNetworkAccounts ERROR: pathIndex is required',
                );
              }
              if (excludedIndexes?.[account.pathIndex] === true) {
                // eslint-disable-next-line no-continue
                continue;
              }
              const key = this.buildNetworkAccountCacheKey({
                walletId,
                networkId,
                deriveType,
                index: account.pathIndex,
              });
              this.checkIfCancelled({ saveToDb, showUIProgress, errorMessage });

              defaultLogger.account.batchCreatePerf.buildAccountAddressDetail();

              const buildAddressStartedAt = Date.now();
              await this.recordPrimeTransferImportBatchCreateTrace({
                event: 'start',
                stage: 'buildAccountAddressDetail',
                walletId,
                networkId,
                deriveType,
                pathIndex: account.pathIndex,
              });
              const addressDetail = await vault?.buildAccountAddressDetail({
                account,
                networkId,
                networkInfo,
              });
              await this.recordPrimeTransferImportBatchCreateTrace({
                event: 'done',
                stage: 'buildAccountAddressDetail',
                walletId,
                networkId,
                deriveType,
                pathIndex: account.pathIndex,
                elapsedMs: Date.now() - buildAddressStartedAt,
              });
              const accountForCreate: IBatchCreateAccount = {
                ...account,
                addressDetail,
                existsInDb: false,
                displayAddress:
                  addressDetail?.displayAddress ||
                  addressDetail?.address ||
                  account?.address ||
                  '',
              };

              this.checkIfCancelled({ saveToDb, showUIProgress, errorMessage });

              defaultLogger.account.batchCreatePerf.processAccountForCreate();
              const processAccountStartedAt = Date.now();
              await this.recordPrimeTransferImportBatchCreateTrace({
                event: 'start',
                stage: 'processAccountForCreate',
                walletId,
                networkId,
                deriveType,
                pathIndex: account.pathIndex,
              });
              await processAccountForCreateFn({
                key,
                accountForCreate,
              });
              await this.recordPrimeTransferImportBatchCreateTrace({
                event: 'done',
                stage: 'processAccountForCreate',
                walletId,
                networkId,
                deriveType,
                pathIndex: account.pathIndex,
                batchProgressCurrent: this.progressInfo?.progressCurrent,
                batchProgressTotal: this.progressInfo?.progressTotal,
                batchCreatedCount: this.progressInfo?.createdCount,
                batchTotalCount: this.progressInfo?.totalCount,
                elapsedMs: Date.now() - processAccountStartedAt,
              });
              defaultLogger.account.batchCreatePerf.processAccountForCreateDone();
            } catch (error) {
              await this.recordPrimeTransferImportBatchCreateTrace({
                event: 'error',
                stage: 'buildOrProcessAccountForCreate',
                walletId,
                networkId,
                deriveType,
                error: this.getErrorMessage(error),
              });
              this.forceExitFlowWhenErrorMatched({
                error,
                walletId,
                saveToDb,
                showUIProgress,
              });
            }
          }
        } catch (error) {
          await this.recordPrimeTransferImportBatchCreateTrace({
            event: 'error',
            stage: 'prepareOrBuildAccountsChunk',
            walletId,
            networkId,
            deriveType,
            indexes: indexesForRebuildChunk,
            error: this.getErrorMessage(error),
          });
          this.forceExitFlowWhenErrorMatched({
            error,
            walletId,
            saveToDb,
            showUIProgress,
          });
        }
      }
    }

    if (saveToDb) {
      const shouldEmitEvent = await this.shouldEmitAccountUpdateEvent();
      if (shouldEmitEvent) {
        appEventBus.emit(EAppEventBusNames.AddDBAccountsToWallet, {
          walletId,
          accounts: accountsForCreate,
        });
      }
    }
    return { accountsForCreate };
  }
}

export default ServiceBatchCreateAccount;
