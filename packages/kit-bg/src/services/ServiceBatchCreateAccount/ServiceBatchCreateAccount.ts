import { HardwareErrorCode } from '@onekeyfe/hd-shared';
import { chunk, isNil, range, uniqBy } from 'lodash';

import {
  backgroundClass,
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import {
  convertDeviceResponse,
  isHardwareErrorByCode,
  isHardwareInterruptErrorByCode,
} from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IBatchCreateAccount } from '@onekeyhq/shared/types/account';
import { EHardwareCallContext } from '@onekeyhq/shared/types/device';

import localDb from '../../dbs/local/localDb';
import { vaultFactory } from '../../vaults/factory';
import { getVaultSettings } from '../../vaults/settings';
import { buildDefaultAddAccountNetworks } from '../ServiceAccount/defaultNetworkAccountsConfig';
import ServiceBase from '../ServiceBase';

import type {
  IAccountDeriveTypes,
  IHwAllNetworkPrepareAccountsResponse,
} from '../../vaults/types';
import type { IWithHardwareProcessingControlParams } from '../ServiceHardwareUI/ServiceHardwareUI';
import type { AllNetworkAddressParams } from '@onekeyfe/hd-core';

export type IBatchCreateAccountProgressInfo = {
  totalCount: number;
  progressTotal: number;
  progressCurrent: number;
  createdCount: number;
};

export type IBatchBuildAccountsBaseParams = {
  walletId: string;
  networkId: string;
  deriveType: IAccountDeriveTypes;
  showUIProgress?: boolean;
  createAllDeriveTypes?: boolean;
  errorMessage?: string;
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
};
export type IBatchBuildAccountsAdvancedFlowParams =
  IBatchBuildAccountsBaseParams & IAdvancedModeFlowParamsBase;
export type IBatchBuildAccountsAdvancedFlowForAllNetworkParams = {
  includingDefaultNetworks?: boolean;
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
        const hwAllNetworkPrepareAccountsResponse =
          await this.getHwAllNetworkPrepareAccountsResponse({
            walletId: payload.params.walletId,
            hideCheckingDeviceLoading: payload.params.hideCheckingDeviceLoading,
            excludedIndexes,
            indexes,
            networksParams,
            saveToCache: payload.saveToCache,
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
            const resp = await this.batchBuildAccounts({
              ...payload.params,
              ...networkParams,
              indexes,
              excludedIndexes,
              saveToDb,
              saveToCache: payload.saveToCache,
              hwAllNetworkPrepareAccountsResponse,
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
          });
        },
        {
          deviceParams,
          skipDeviceCancel: true,
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
  }: {
    walletId: string;
  }): Promise<IBatchBuildAccountsBaseParams[]> {
    const networks = await buildDefaultAddAccountNetworks({
      backgroundApi: this.backgroundApi,
      includingNetworkWithGlobalDeriveType: true,
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
    skipDeviceCancel,
    hideCheckingDeviceLoading,
    skipCloseHardwareUiStateDialog,
    customNetworks,
    autoHandleExitError = true,
  }: {
    autoHandleExitError?: boolean;
    walletId: string | undefined;
    indexedAccountId: string | undefined;
    customNetworks?: { networkId: string; deriveType: IAccountDeriveTypes }[];
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
      if (!indexedAccountId) {
        throw new OneKeyLocalError('indexedAccountId is required');
      }

      const index = accountUtils.parseIndexedAccountId({
        indexedAccountId,
      }).index;
      return this.startBatchCreateAccountsFlowForAllNetwork({
        walletId,
        fromIndex: index,
        toIndex: index,
        excludedIndexes: {},
        saveToDb: true,
        customNetworks: customNetworks || [],
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
    customNetworks:
      | { networkId: string; deriveType: IAccountDeriveTypes }[]
      | undefined;
  }) {
    let networksParams: IBatchBuildAccountsBaseParams[] = [];

    if (params.includingDefaultNetworks) {
      networksParams = networksParams.concat(
        await this.buildDefaultNetworksForBatchCreate({
          walletId: params.walletId,
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
  }) {
    let hwAllNetworkPrepareAccountsResponse:
      | IHwAllNetworkPrepareAccountsResponse
      | undefined;

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
                const allNetworkPrepareParam =
                  await vault.keyring.buildHwAllNetworkPrepareAccountsParams({
                    path,
                    template: deriveInfo.template,
                    index: i,
                    addressEncoding: deriveInfo.addressEncoding,
                  });
                if (allNetworkPrepareParam) {
                  allNetworkPrepareParam.showOnOneKey =
                    params.showOnOneKey ?? allNetworkPrepareParam.showOnOneKey;
                  bundleParams.push(allNetworkPrepareParam);
                }
              }
            }
          }
          if (bundleParams.length && deviceParams?.dbDevice) {
            const sdk = await this.backgroundApi.serviceHardware.getSDKInstance(
              {
                connectId: deviceParams.dbDevice?.connectId,
              },
            );
            hwAllNetworkPrepareAccountsResponse = (await convertDeviceResponse(
              async () => {
                // throw new NewFirmwareForceUpdate({ payload: {} });

                appEventBus.emit(
                  EAppEventBusNames.SDKGetAllNetworkAddressesStart,
                  undefined,
                );
                try {
                  const compatibleConnectId =
                    await this.backgroundApi.serviceHardware.getCompatibleConnectId(
                      {
                        connectId: deviceParams.dbDevice?.connectId || '',
                        featuresDeviceId: deviceParams.dbDevice?.deviceId || '',
                        hardwareCallContext:
                          EHardwareCallContext.USER_INTERACTION,
                      },
                    );
                  const sdkAllNetworkGetAddressResponse =
                    await sdk.allNetworkGetAddress(
                      compatibleConnectId,
                      deviceParams.dbDevice?.deviceId || '',
                      {
                        ...deviceParams.deviceCommonParams,
                        bundle: bundleParams,
                      },
                    );

                  console.log('sdk.allNetworkGetAddress response', {
                    bundle: bundleParams,
                    response: sdkAllNetworkGetAddressResponse,
                  });

                  return sdkAllNetworkGetAddressResponse;
                } finally {
                  appEventBus.emit(
                    EAppEventBusNames.SDKGetAllNetworkAddressesEnd,
                    undefined,
                  );
                }
              },
            )) as any; // TODO sdk type error
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

    return this.backgroundApi.serviceHardwareUI.withHardwareProcessing(
      async () => {
        const networksParams: IBatchBuildAccountsBaseParams[] =
          await this.buildBatchCreateAccountsNetworksParams({
            walletId: params.walletId,
            customNetworks: params.customNetworks,
            includingDefaultNetworks: params.includingDefaultNetworks ?? true,
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

        const hwAllNetworkPrepareAccountsResponse =
          await this.getHwAllNetworkPrepareAccountsResponse({
            walletId: params.walletId,
            hideCheckingDeviceLoading: params.hideCheckingDeviceLoading,
            excludedIndexes,
            indexes,
            networksParams,
          });

        for (const networkParams of networksParams) {
          try {
            this.checkIfCancelled({
              saveToDb,
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
            });
            addedAccounts.push({
              networkId: networkParams.networkId,
              deriveType: networkParams.deriveType,
            });
          } catch (error: any) {
            this.forceExitFlowWhenErrorMatched({
              error,
              walletId: params.walletId,
              saveToDb,
              autoHandleExitError: params.autoHandleExitError,
            });
            failedAccounts.push({
              networkId: networkParams.networkId,
              deriveType: networkParams.deriveType,
              error: errorUtils.toPlainErrorObject(error),
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
            HardwareErrorCode.DeviceNotFound,
            // **** PIN\passphrase cancel
            HardwareErrorCode.PinCancelled,
            HardwareErrorCode.ActionCancelled,
            HardwareErrorCode.DeviceInterruptedFromOutside, // cancel PIN from app
            HardwareErrorCode.DeviceInterruptedFromUser, // cancel PIN from app
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

  async emitBatchCreateDoneEvents({
    saveToDb,
    showUIProgress,
  }: {
    saveToDb?: boolean;
    showUIProgress?: boolean;
  } = {}) {
    if (saveToDb) {
      appEventBus.emit(EAppEventBusNames.AccountUpdate, undefined);
      // TODO auto backup execute twice with EAppEventBusNames.AccountUpdate?
      void this.backgroundApi.serviceCloudBackup.requestAutoBackup();
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
      this.checkIfCancelled({ saveToDb, showUIProgress, errorMessage });
      await this.updateAccountExistsInDb({ account: accountForCreate });
      if (saveToCache) {
        this.networkAccountsCache[key] = accountForCreate;
      }
      accountsForCreate.push(accountForCreate);
      if (saveToDb) {
        if (!accountForCreate.existsInDb) {
          this.checkIfCancelled({ saveToDb, showUIProgress, errorMessage });
          await this.backgroundApi.serviceAccount.addBatchCreatedHdOrHwAccount({
            walletId,
            networkId,
            account: accountForCreate,
            indexedAccountNames,
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
      const indexesChunks = chunk(indexesForRebuild, 10);
      for (let i = 0; i < indexesChunks.length; i += 1) {
        const indexesForRebuildChunk = indexesChunks[i];
        try {
          this.checkIfCancelled({ saveToDb, showUIProgress, errorMessage });
          defaultLogger.account.batchCreatePerf.prepareHdOrHwAccounts();

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
            });

          if (i !== indexesChunks.length - 1) {
            await timerUtils.wait(300);
          }

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

              const addressDetail = await vault?.buildAccountAddressDetail({
                account,
                networkId,
                networkInfo,
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
              await processAccountForCreateFn({
                key,
                accountForCreate,
              });
              defaultLogger.account.batchCreatePerf.processAccountForCreateDone();
            } catch (error) {
              this.forceExitFlowWhenErrorMatched({
                error,
                walletId,
                saveToDb,
                showUIProgress,
              });
            }
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
    }

    if (saveToDb) {
      appEventBus.emit(EAppEventBusNames.AddDBAccountsToWallet, {
        walletId,
        accounts: accountsForCreate,
      });
    }
    return { accountsForCreate };
  }
}

export default ServiceBatchCreateAccount;
