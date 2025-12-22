import { EFirmwareType } from '@onekeyfe/hd-shared';
import BigNumber from 'bignumber.js';
import { isEmpty, isNil, uniq, uniqBy } from 'lodash';

import type { CoreChainScopeBase } from '@onekeyhq/core/src/base/CoreChainScopeBase';
import { getCoreChainApiScopeByImpl } from '@onekeyhq/core/src/instance/coreChainApi';
import {
  type EAddressEncodings,
  ECoreApiExportedSecretKeyType,
} from '@onekeyhq/core/src/types';
import {
  backgroundClass,
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  dangerAggregateTokenNetworkRepresent,
  getPresetNetworks,
  presetNetworksMap,
} from '@onekeyhq/shared/src/config/presetNetworks';
import {
  AGGREGATE_TOKEN_MOCK_NETWORK_ID,
  NETWORK_SHOW_VALUE_THRESHOLD_USD,
} from '@onekeyhq/shared/src/consts/networkConsts';
import { IMPL_BTC, SEPERATOR } from '@onekeyhq/shared/src/engine/engineConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import perfUtils, {
  EPerformanceTimerLogNames,
} from '@onekeyhq/shared/src/utils/debug/perfUtils';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import type {
  IDetectedNetwork,
  IDetectedNetworkGroupItem,
} from '@onekeyhq/shared/src/utils/networkDetectUtils';
import networkDetectUtils from '@onekeyhq/shared/src/utils/networkDetectUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { vaultFactory } from '../../vaults/factory';
import {
  getVaultSettings,
  getVaultSettingsAccountDeriveInfo,
} from '../../vaults/settings';
import ServiceBase from '../ServiceBase';

import type { IDBAccount } from '../../dbs/local/types';
import type { IAccountSelectorPersistInfo } from '../../dbs/simple/entity/SimpleDbEntityAccountSelector';
import type {
  IAccountDeriveInfo,
  IAccountDeriveInfoItems,
  IAccountDeriveTypes,
} from '../../vaults/types';

const defaultPinnedNetworkIds = [
  getNetworkIdsMap().btc,
  getNetworkIdsMap().lightning,
  getNetworkIdsMap().eth,
  getNetworkIdsMap().trx,
  getNetworkIdsMap().sol,
  getNetworkIdsMap().bsc,
  getNetworkIdsMap().polygon,
  getNetworkIdsMap().ton,
];

@backgroundClass()
class ServiceNetwork extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  async getAllNetworks(
    params: {
      excludeAllNetworkItem?: boolean;
      excludeCustomNetwork?: boolean;
      excludeNetworkIds?: string[];
      excludeTestNetwork?: boolean;
      uniqByImpl?: boolean;
      clearCache?: boolean;
    } = {},
  ): Promise<{ networks: IServerNetwork[] }> {
    const perf = perfUtils.createPerf({
      name: EPerformanceTimerLogNames.serviceNetwork__getAllNetworksWithCache,
    });
    const { clearCache } = params;
    if (clearCache) {
      await this.getAllNetworksWithCache.clear();
    }
    perf.markStart('getAllNetworksWithCache');
    const result = await this.getAllNetworksWithCache(params);
    perf.markEnd('getAllNetworksWithCache');
    perf.done();
    return result;
  }

  getAllNetworksWithCache = memoizee(
    async (
      params: {
        excludeAllNetworkItem?: boolean;
        excludeCustomNetwork?: boolean;
        excludeNetworkIds?: string[];
        excludeTestNetwork?: boolean;
        uniqByImpl?: boolean;
      } = {},
    ) => {
      const perf = perfUtils.createPerf({
        name: EPerformanceTimerLogNames.serviceNetwork__getAllNetworks,
      });

      perf.markStart('getPresetNetworks');
      // TODO save to simpleDB
      const excludeTestNetwork = params?.excludeTestNetwork ?? false;
      const uniqByImpl = params?.uniqByImpl ?? false;
      const excludeNetworkIds = params?.excludeNetworkIds ?? [];
      if (params.excludeAllNetworkItem) {
        excludeNetworkIds.push(getNetworkIdsMap().onekeyall);
      }
      const presetNetworks = getPresetNetworks();
      perf.markEnd('getPresetNetworks');

      perf.markStart('getServerNetworks-and-getAllCustomNetworks');
      // Fetch server and custom networks
      const [serverNetworks, customNetworks] = await Promise.all([
        this.backgroundApi.serviceCustomRpc.getServerNetworks(),
        this.backgroundApi.serviceCustomRpc.getAllCustomNetworks(),
      ]);
      perf.markEnd('getServerNetworks-and-getAllCustomNetworks');

      // Create a Map to store unique networks by id
      // Priority: serverNetworks > presetNetworks > customNetworks
      const networkMap = new Map<string, IServerNetwork>();

      // Helper function to add networks to the map
      const addNetworks = (networks: IServerNetwork[]) => {
        networks.forEach((network) => {
          if (!networkMap.has(network.id)) {
            networkMap.set(network.id, network);
          }
        });
      };

      perf.markStart('addNetworks-presetNetworks');
      // Add networks in order of priority
      addNetworks(presetNetworks);
      perf.markEnd('addNetworks-presetNetworks');

      perf.markStart('addNetworks-serverNetworks');
      addNetworks(serverNetworks);
      perf.markEnd('addNetworks-serverNetworks');

      perf.markStart('addNetworks-customNetworks');
      addNetworks(customNetworks);
      perf.markEnd('addNetworks-customNetworks');

      perf.markStart('convertMapToArray');
      // Convert Map back to array
      let networks = Array.from(networkMap.values());
      perf.markEnd('convertMapToArray');

      perf.markStart('filterNetworks-excludeCustomNetwork');
      if (params.excludeCustomNetwork) {
        excludeNetworkIds.push(...customNetworks.map((n) => n.id));
      }
      perf.markEnd('filterNetworks-excludeCustomNetwork');

      perf.markStart('filterNetworks-uniqByImpl');
      if (uniqByImpl) {
        networks = uniqBy(networks, (n) => n.impl);
      }
      perf.markEnd('filterNetworks-uniqByImpl');

      perf.markStart('filterNetworks-excludeTestNetwork');
      if (excludeTestNetwork) {
        networks = networks.filter((n) => !n.isTestnet);
      }
      perf.markEnd('filterNetworks-excludeTestNetwork');

      perf.markStart('filterNetworks-excludeNetworkIds');
      if (excludeNetworkIds?.length) {
        networks = networks.filter((n) => !excludeNetworkIds.includes(n.id));
      }
      perf.markEnd('filterNetworks-excludeNetworkIds');

      perf.done();

      return Promise.resolve({ networks });
    },
    {
      promise: true,
      maxAge: 5 * 60 * 1000,
    },
  );

  @backgroundMethod()
  async getAllNetworkIds({
    clearCache,
    excludeTestNetwork,
  }: { clearCache?: boolean; excludeTestNetwork?: boolean } = {}): Promise<{
    networkIds: string[];
  }> {
    const { networks } = await this.getAllNetworks({
      clearCache,
      excludeTestNetwork,
    });
    const networkIds = networks.map((n) => n.id);
    return {
      networkIds,
    };
  }

  @backgroundMethod()
  async getAllNetworkImpls(): Promise<{ impls: string[] }> {
    const { networks } = await this.getAllNetworks();
    const impls = uniq(networks.map((n) => n.impl));
    return {
      impls,
    };
  }

  @backgroundMethod()
  async getNetwork({
    networkId,
    code,
  }: {
    networkId?: string;
    code?: string;
  }): Promise<IServerNetwork> {
    if (networkId === AGGREGATE_TOKEN_MOCK_NETWORK_ID) {
      return dangerAggregateTokenNetworkRepresent;
    }

    const { networks } = await this.getAllNetworks();
    let network: IServerNetwork | undefined;
    if (!network && networkId) {
      network = networks.find((n) => n.id === networkId);
    }
    if (!network && code) {
      network = networks.find((n) => n.code === code);
    }
    if (!network && code) {
      const mainChainList = [0, 1].map((num) => `${networkId ?? ''}--${num}`);
      network = networks.find(
        (n) => mainChainList.findIndex((id) => id === n.id) !== -1,
      );
    }
    if (!network) {
      throw new OneKeyLocalError(
        `getNetwork ERROR: Network not found: ${networkId || ''} ${code || ''}`,
      );
    }
    return network;
  }

  @backgroundMethod()
  async getNetworkSafe({
    networkId,
    code,
  }: {
    networkId?: string;
    code?: string;
  }): Promise<IServerNetwork | undefined> {
    try {
      return await this.getNetwork({ networkId, code });
    } catch (error) {
      return undefined;
    }
  }

  @backgroundMethod()
  async getNetworksByIds({
    networkIds,
  }: {
    networkIds: string[];
  }): Promise<{ networks: IServerNetwork[] }> {
    const { networks } = await this.getAllNetworks();
    return {
      networks: networks.filter((n) => networkIds.includes(n.id)),
    };
  }

  @backgroundMethod()
  async getNetworksByImpls({
    impls,
  }: {
    impls: string[];
  }): Promise<{ networks: IServerNetwork[] }> {
    const { networks } = await this.getAllNetworks();
    return {
      networks: networks.filter((n) => impls.includes(n.impl)),
    };
  }

  @backgroundMethod()
  async getNetworkIdsByImpls({
    impls,
  }: {
    impls: string[];
  }): Promise<{ networkIds: string[] }> {
    const { networks } = await this.getNetworksByImpls({ impls });
    return {
      networkIds: networks.map((n) => n.id),
    };
  }

  @backgroundMethod()
  public async getNetworkByImplListAndChainId(
    implList: string[],
    chainId: string,
  ) {
    const { networks } = await this.getNetworksByImpls({
      impls: implList,
    });
    return networks.find((n) => n.chainId === chainId);
  }

  @backgroundMethod()
  async getVaultSettings({ networkId }: { networkId: string }) {
    const settings = await getVaultSettings({ networkId });
    return settings;
  }

  @backgroundMethod()
  async filterNetworks({
    networks,
    searchKey,
  }: {
    networks: IServerNetwork[];
    searchKey: string;
  }) {
    const key = searchKey.toLowerCase();
    if (key) {
      return networks.filter(
        (o) =>
          o.name.toLowerCase().includes(key) ||
          o.shortname.toLowerCase().includes(key),
      );
    }
    return networks;
  }

  async containsNetwork({
    impls,
    networkId,
  }: {
    impls?: string[];
    networkId: string;
  }) {
    let networkIds: string[];
    if (impls) {
      ({ networkIds } = await this.getNetworkIdsByImpls({ impls }));
    } else {
      ({ networkIds } = await this.getAllNetworkIds());
    }
    return networkIds.includes(networkId);
  }

  @backgroundMethod()
  async getDeriveInfoMapOfNetwork({ networkId }: { networkId: string }) {
    const settings = await this.getVaultSettings({
      networkId,
    });
    // TODO remove ETC config
    return settings.accountDeriveInfo;
  }

  @backgroundMethod()
  async getDeriveTypeByTemplate({
    accountId,
    networkId,
    template,
  }: {
    accountId: string;
    networkId: string;
    template: string | undefined;
  }): Promise<{
    deriveType: IAccountDeriveTypes;
    deriveInfo: IAccountDeriveInfo | undefined;
  }> {
    if (!template) {
      return { deriveType: 'default', deriveInfo: undefined };
    }
    const deriveInfoItems = await this.getDeriveInfoItemsOfNetwork({
      networkId,
    });
    let deriveInfo: IAccountDeriveInfoItems | undefined;
    if (
      deriveInfoItems.length > 1 &&
      deriveInfoItems[0].item.useAddressEncodingDerive &&
      accountId.split('--').length > 2
    ) {
      deriveInfo = deriveInfoItems.find(
        (item) =>
          item.item.template === template &&
          item.item.addressEncoding &&
          accountId.endsWith(item.item.addressEncoding),
      );
    }
    if (!deriveInfo) {
      deriveInfo = deriveInfoItems.find(
        (item) => item.item.template === template,
      );
    }
    const deriveType = deriveInfo?.value as IAccountDeriveTypes | undefined;
    return {
      deriveType: deriveType || 'default',
      deriveInfo: deriveInfo?.item,
    };
  }

  @backgroundMethod()
  async getDeriveTypeByDBAccount({
    networkId,
    account,
  }: {
    networkId: string;
    account: {
      id: string;
      address: string;
      template?: string | undefined;
    };
  }): Promise<{
    deriveType: IAccountDeriveTypes;
    deriveInfo: IAccountDeriveInfo | undefined;
  }> {
    const { template } = account;
    const deriveTypeData = await this.getDeriveTypeByTemplate({
      accountId: account.id,
      networkId,
      template,
    });
    if (!deriveTypeData.deriveInfo && account.address) {
      const deriveInfo = await this.getDeriveInfoByAddress({
        networkId,
        address: account.address,
      });
      if (deriveInfo?.item && deriveInfo?.value) {
        deriveTypeData.deriveInfo = deriveInfo?.item;
        deriveTypeData.deriveType = deriveInfo?.value as IAccountDeriveTypes;
      }
    }
    return deriveTypeData;
  }

  async getDeriveTemplateByPath({
    networkId,
    path,
  }: {
    networkId: string;
    path: string;
  }): Promise<string | undefined> {
    const deriveInfoItems = await this.getDeriveInfoItemsOfNetwork({
      networkId,
    });
    const findMap: { [template: string]: number } = {};
    const pathSegments = path.split('/');
    for (const item of deriveInfoItems) {
      const template = item.item.template;
      const templateSegments = template.split('/');
      let matchedCount = 0;
      for (let i = 0; i < pathSegments.length; i += 1) {
        if (pathSegments[i] === templateSegments[i]) {
          matchedCount += 1;
        } else {
          break;
        }
      }
      findMap[template] = matchedCount;
    }

    let findTemplate: string | undefined;
    let findMatchedCount = 0;
    Object.entries(findMap).forEach(([k, v]) => {
      if (v >= findMatchedCount) {
        findTemplate = k;
        findMatchedCount = v;
      }
    });

    return findTemplate;
  }

  @backgroundMethod()
  async isDeriveTypeAvailableForNetwork({
    networkId,
    deriveType,
  }: {
    networkId: string;
    deriveType: IAccountDeriveTypes;
  }): Promise<boolean> {
    const deriveInfoItems = await this.getDeriveInfoItemsOfNetwork({
      networkId,
    });
    return Boolean(deriveInfoItems.find((item) => item.value === deriveType));
  }

  @backgroundMethod()
  async getDeriveInfoItemsOfNetwork({
    networkId,
    enabledItems,
  }: {
    networkId: string | undefined;
    enabledItems?: IAccountDeriveInfo[];
  }): Promise<IAccountDeriveInfoItems[]> {
    if (!networkId) {
      return [];
    }
    const map = await this.getDeriveInfoMapOfNetwork({
      networkId,
    });
    return Object.entries(map)
      .map(([k, v]) => {
        if (
          enabledItems &&
          !enabledItems.find((item) => item.template === v.template)
        ) {
          return null;
        }
        const { desc, subDesc, descI18n } = v;
        let description = desc || subDesc;
        if (descI18n?.id) {
          description = appLocale.intl.formatMessage(
            { id: descI18n?.id },
            descI18n?.data,
          );
        }

        const d: IAccountDeriveInfoItems = {
          item: v,
          description,
          descI18n,
          value: k,
          label:
            (v.labelKey
              ? appLocale.intl.formatMessage({ id: v.labelKey })
              : v.label) || k,
        };
        return d;
      })
      .filter(Boolean);
  }

  @backgroundMethod()
  async getDeriveInfoOfNetwork({
    networkId,
    deriveType,
  }: {
    networkId: string;
    deriveType: IAccountDeriveTypes;
  }): Promise<IAccountDeriveInfo> {
    return getVaultSettingsAccountDeriveInfo({ networkId, deriveType });
  }

  @backgroundMethod()
  async setNetworkSelectorPinnedNetworkIds({
    networkIds,
  }: {
    networkIds: string[];
  }) {
    const inputs = networkIds.filter(
      (networkId) => !networkUtils.isAllNetwork({ networkId }),
    );
    return this.backgroundApi.simpleDb.networkSelector.setPinnedNetworkIds({
      networkIds: inputs,
    });
  }

  @backgroundMethod()
  async getNetworkSelectorPinnedNetworkIds(useDefaultPinnedNetworks?: boolean) {
    const pinnedNetworkIds = useDefaultPinnedNetworks
      ? defaultPinnedNetworkIds
      : await this.backgroundApi.simpleDb.networkSelector.getPinnedNetworkIds();
    const networkIds = pinnedNetworkIds;
    return networkIds ?? defaultPinnedNetworkIds;
  }

  @backgroundMethod()
  async getNetworkSelectorPinnedNetworks({
    useDefaultPinnedNetworks,
  }: {
    useDefaultPinnedNetworks?: boolean;
  }): Promise<IServerNetwork[]> {
    let networkIds = await this.getNetworkSelectorPinnedNetworkIds(
      useDefaultPinnedNetworks,
    );
    networkIds = networkIds.filter((id) => id !== getNetworkIdsMap().onekeyall);
    const networkIdsIndex = networkIds.reduce((result, item, index) => {
      result[item] = index;
      return result;
    }, {} as Record<string, number>);
    const resp = await this.getNetworksByIds({ networkIds });
    const sorted = resp.networks.sort(
      (a, b) => networkIdsIndex[a.id] - networkIdsIndex[b.id],
    );
    return sorted;
  }

  @backgroundMethod()
  async getGlobalDeriveTypeOfNetwork({
    networkId,
    rawData,
  }: {
    networkId: string;
    rawData?: IAccountSelectorPersistInfo | null;
  }): Promise<IAccountDeriveTypes> {
    const currentGlobalDeriveType =
      await this.backgroundApi.simpleDb.accountSelector.getGlobalDeriveType({
        networkId,
        rawData,
      });
    return currentGlobalDeriveType ?? 'default';
  }

  @backgroundMethod()
  async getDeriveTypeOrFallbackToGlobal({
    deriveType,
    networkId,
  }: {
    deriveType: IAccountDeriveTypes | undefined;
    networkId: string | undefined;
  }): Promise<IAccountDeriveTypes | undefined> {
    if (deriveType) {
      return deriveType;
    }
    if (networkId) {
      return this.getGlobalDeriveTypeOfNetwork({ networkId });
    }
    return undefined;
  }

  @backgroundMethod()
  async saveGlobalDeriveTypeForNetwork({
    networkId,
    deriveType,
    eventEmitDisabled,
  }: {
    deriveType: IAccountDeriveTypes;
    networkId: string;
    eventEmitDisabled?: boolean | undefined;
  }) {
    const deriveInfoItems = await this.getDeriveInfoItemsOfNetwork({
      networkId,
    });
    if (deriveInfoItems.find((item) => item.value === deriveType)) {
      await this.backgroundApi.simpleDb.accountSelector.saveGlobalDeriveType({
        eventEmitDisabled,
        networkId,
        deriveType,
      });
    }
  }

  @backgroundMethod()
  async getAddressEncodingByAddress({
    networkId,
    address,
  }: {
    networkId: string;
    address: string;
  }): Promise<EAddressEncodings | undefined> {
    const vault = await vaultFactory.getChainOnlyVault({
      networkId,
    });
    try {
      // validateBtcAddress
      const vaultSetting = await vault.validateAddress(address);
      return vaultSetting?.encoding;
    } catch (e) {
      console.error('getAddressEncodingByAddress error', e);
      return undefined;
    }
  }

  @backgroundMethod()
  async getDeriveInfoByAddress({
    networkId,
    address,
  }: {
    networkId: string;
    address: string;
  }): Promise<IAccountDeriveInfoItems | undefined> {
    const encoding = await this.getAddressEncodingByAddress({
      networkId,
      address,
    });
    if (!encoding) {
      return undefined;
    }
    return this.getDeriveInfoByAddressEncoding({
      networkId,
      encoding,
    });
  }

  @backgroundMethod()
  async getDeriveTypeByAddress({
    networkId,
    address,
  }: {
    networkId: string;
    address: string;
  }): Promise<IAccountDeriveTypes | undefined> {
    const deriveInfo = await this.getDeriveInfoByAddress({
      networkId,
      address,
    });
    return (deriveInfo?.value as IAccountDeriveTypes | undefined) || undefined;
  }

  @backgroundMethod()
  async getDeriveTypeByAddressEncoding({
    networkId,
    encoding,
  }: {
    networkId: string;
    encoding: EAddressEncodings;
  }): Promise<IAccountDeriveTypes | undefined> {
    const deriveInfo = await this.getDeriveInfoByAddressEncoding({
      networkId,
      encoding,
    });
    return deriveInfo?.value as IAccountDeriveTypes | undefined;
  }

  async getDeriveInfoByAddressEncoding({
    networkId,
    encoding,
  }: {
    networkId: string;
    encoding: EAddressEncodings;
  }): Promise<IAccountDeriveInfoItems | undefined> {
    const items = await this.getDeriveInfoItemsOfNetwork({ networkId });
    const deriveInfo = items.find(
      (item) => item.item.addressEncoding === encoding,
    );

    return deriveInfo;
  }

  async getAccountImportingDeriveTypes({
    accountId,
    networkId,
    input,
    validateAddress,
    validateXpub,
    validatePrivateKey,
    validateXprvt,
    template,
  }: {
    accountId: string;
    networkId: string;
    input: string;
    validateAddress?: boolean;
    validateXpub?: boolean;
    validateXprvt?: boolean;
    validatePrivateKey?: boolean;
    template: string | undefined;
  }) {
    const { serviceAccount, servicePassword, serviceNetwork } =
      this.backgroundApi;

    const { deriveType: deriveTypeInTpl } =
      await serviceNetwork.getDeriveTypeByTemplate({
        accountId,
        networkId,
        template,
      });
    let deriveTypes: IAccountDeriveTypes[] = [deriveTypeInTpl];

    const validateResult = await serviceAccount.validateGeneralInputOfImporting(
      {
        networkId,
        input: await servicePassword.encodeSensitiveText({ text: input }),
        validateAddress,
        validateXpub,
        validatePrivateKey,
        validateXprvt,
      },
    );
    if (validateResult?.deriveInfoItems?.length) {
      const availableDeriveTypes = (
        await serviceNetwork.getDeriveInfoItemsOfNetwork({
          networkId,
          enabledItems: validateResult.deriveInfoItems,
        })
      ).map((item) => item.value);
      deriveTypes = [
        ...deriveTypes,
        ...(availableDeriveTypes as IAccountDeriveTypes[]),
      ];
    }
    deriveTypes = uniq(deriveTypes);
    return deriveTypes;
  }

  private _getNetworkVaultSettings = memoizee(
    async () => {
      const { networks } = await this.getAllNetworks();
      const result = await Promise.all(
        networks.map(async (network) => {
          const vault = await vaultFactory.getChainOnlyVault({
            networkId: network.id,
          });
          const vaultSetting = await vault.getVaultSettings();
          return {
            network,
            vaultSetting,
          };
        }),
      );
      return result;
    },
    { max: 1 },
  );

  @backgroundMethod()
  async getImportedAccountEnabledNetworks() {
    const settings = await this._getNetworkVaultSettings();
    return settings
      .filter((o) => o.vaultSetting.importedAccountEnabled)
      .map((o) => o.network);
  }

  @backgroundMethod()
  async getWatchingAccountEnabledNetworks() {
    const settings = await this._getNetworkVaultSettings();
    return settings
      .filter((o) => o.vaultSetting.watchingAccountEnabled)
      .map((o) => o.network);
  }

  @backgroundMethod()
  async getPublicKeyExportEnabledNetworks() {
    const settings = await this._getNetworkVaultSettings();
    return settings
      .filter((o) => o.vaultSetting.publicKeyExportEnabled)
      .map((o) => o.network);
  }

  @backgroundMethod()
  async getPublicKeyExportOrWatchingAccountEnabledNetworks() {
    const settings = await this._getNetworkVaultSettings();
    return settings
      .filter(
        (o) =>
          o.vaultSetting.publicKeyExportEnabled ||
          o.vaultSetting.watchingAccountEnabled,
      )
      .map((o) => ({
        network: o.network,
        publicKeyExportEnabled: o.vaultSetting.publicKeyExportEnabled,
        watchingAccountEnabled: o.vaultSetting.watchingAccountEnabled,
      }));
  }

  @backgroundMethod()
  @toastIfError()
  async detectNetworksByAddress({ address }: { address: string }): Promise<{
    detectedNetworks: IDetectedNetworkGroupItem[];
  }> {
    // eslint-disable-next-line no-param-reassign
    address = address?.trim?.() || '';
    if (!address) {
      return {
        detectedNetworks: [],
      };
    }
    const availableNetworks: IServerNetwork[] =
      await this.getWatchingAccountEnabledNetworks();
    const detectedNetworks: IDetectedNetworkGroupItem[] = [];
    const detectedNetworksMap: Record<string, IDetectedNetwork[]> = {};

    for (const network of availableNetworks) {
      try {
        const localValidateResult =
          await this.backgroundApi.serviceValidator.localValidateAddress({
            networkId: network.id,
            address,
          });
        if (localValidateResult?.isValid) {
          if (!detectedNetworksMap[network.impl]) {
            detectedNetworksMap[network.impl] = [];
          }
          detectedNetworksMap[network.impl].push({
            networkId: network.id,
            name: network.name,
            shortname: network.shortname,
            impl: network.impl,
          });
        }
      } catch (error) {
        console.error('detectNetworksByAddress error', network.id, error);
      }
    }
    Object.entries(detectedNetworksMap).forEach(([impl, networks]) => {
      if (networks.length > 0) {
        detectedNetworks.push({
          uuid: stringUtils.generateUUID(),
          impl,
          networks,
        });
      }
    });
    return {
      detectedNetworks,
    };
  }

  @backgroundMethod()
  @toastIfError()
  async detectNetworksByPublicKey({
    publicKey,
  }: {
    publicKey: string;
  }): Promise<{
    detectedNetworks: IDetectedNetworkGroupItem[];
  }> {
    // eslint-disable-next-line no-param-reassign
    publicKey = publicKey?.trim?.() || '';
    if (!publicKey) {
      return {
        detectedNetworks: [],
      };
    }
    const availableNetworks: IServerNetwork[] =
      await this.getPublicKeyExportEnabledNetworks();
    const detectedNetworks: IDetectedNetworkGroupItem[] = [];
    const detectedNetworksMap: Record<string, IDetectedNetwork[]> = {};
    for (const network of availableNetworks) {
      try {
        const result =
          await this.backgroundApi.serviceAccount.validateGeneralInputOfImporting(
            {
              input: publicKey,
              networkId: network.id,
              validateXpub: true,
            },
          );
        if (result?.isValid) {
          if (!detectedNetworksMap[network.impl]) {
            detectedNetworksMap[network.impl] = [];
          }
          detectedNetworksMap[network.impl].push({
            networkId: network.id,
            name: network.name,
            shortname: network.shortname,
            impl: network.impl,
          });
        }
      } catch (error) {
        console.error('detectNetworksByPublicKey error', network.id, error);
      }
    }
    Object.entries(detectedNetworksMap).forEach(([impl, networks]) => {
      if (networks.length > 0) {
        detectedNetworks.push({
          uuid: stringUtils.generateUUID(),
          impl,
          networks,
        });
      }
    });
    return {
      detectedNetworks,
    };
  }

  @backgroundMethod()
  @toastIfError()
  async detectNetworksByPrivateKey({
    privateKey,
  }: {
    privateKey: string;
  }): Promise<{
    detectedNetworks: IDetectedNetworkGroupItem[];
  }> {
    // eslint-disable-next-line no-param-reassign
    privateKey = privateKey?.trim?.() || '';
    if (!privateKey) {
      return {
        detectedNetworks: [],
      };
    }
    // eslint-disable-next-line no-param-reassign
    privateKey = await this.backgroundApi.servicePassword.decodeSensitiveText({
      encodedText: privateKey || '',
    });
    if (!privateKey) {
      return {
        detectedNetworks: [],
      };
    }

    const availableNetworkIds: string[] = (
      await this.getImportedAccountEnabledNetworks()
    ).map((network) => network.id);

    const { groupedByImpl } =
      await networkDetectUtils.detectNetworkByPrivateKey({
        privateKey,
      });
    let results = Object.values(groupedByImpl);
    results = results
      .map((item) => {
        item.networks = item.networks
          .filter((network) => availableNetworkIds.includes(network.networkId))
          .sort((a, b) => {
            if (
              [
                presetNetworksMap.eth.id,
                presetNetworksMap.cosmoshub.id,
                presetNetworksMap.assethubPolkadot.id,
              ].includes(a.networkId)
            ) {
              return -1;
            }
            return 0;
          });
        if (item.networks?.length === 0) {
          // return item;
          return undefined;
        }
        return item;
      })
      .filter(Boolean);
    return {
      detectedNetworks: results,
    };
  }

  @backgroundMethod()
  async getSupportExportAccountKeyNetworks({
    exportType,
  }: {
    exportType: 'privateKey' | 'publicKey' | 'mnemonic';
  }): Promise<
    {
      network: IServerNetwork;
    }[]
  > {
    if (exportType === 'privateKey') {
      return this.getSupportExportPrivateKeyNetworks();
    }
    if (exportType === 'publicKey') {
      return this.getSupportExportPublicKeyNetworks();
    }
    throw new OneKeyLocalError('Not implemented');
  }

  @backgroundMethod()
  async getSupportExportPrivateKeyNetworks() {
    const settings = await this._getNetworkVaultSettings();
    return settings
      .filter(
        (o) =>
          o.vaultSetting?.supportExportedSecretKeys?.includes(
            ECoreApiExportedSecretKeyType.privateKey,
          ) ||
          o.vaultSetting?.supportExportedSecretKeys?.includes(
            ECoreApiExportedSecretKeyType.xprvt,
          ),
      )
      .map((o) => ({
        network: o.network,
      }));
  }

  @backgroundMethod()
  async getSupportExportPublicKeyNetworks() {
    const settings = await this._getNetworkVaultSettings();
    return settings
      .filter(
        (o) =>
          o.vaultSetting?.supportExportedSecretKeys?.includes(
            ECoreApiExportedSecretKeyType.publicKey,
          ) ||
          o.vaultSetting?.supportExportedSecretKeys?.includes(
            ECoreApiExportedSecretKeyType.xpub,
          ),
      )
      .map((o) => ({
        network: o.network,
      }));
  }

  @backgroundMethod()
  async getAddressBookEnabledNetworks() {
    const settings = await this._getNetworkVaultSettings();
    return settings
      .filter((o) => !o.vaultSetting.addressBookDisabled)
      .map((o) => o.network);
  }

  @backgroundMethod()
  async getDappInteractionEnabledNetworks() {
    const settings = await this._getNetworkVaultSettings();
    return settings
      .filter(
        (o) => o.vaultSetting.dappInteractionEnabled && !o.network.isTestnet,
      )
      .map((o) => o.network);
  }

  @backgroundMethod()
  async getCustomTokenEnabledNetworks({
    currentNetworkId,
  }: {
    currentNetworkId: string;
  }) {
    const settings = await this._getNetworkVaultSettings();
    const allNetworkId = getNetworkIdsMap().onekeyall;
    return settings
      .filter((o) => {
        if (o.network.id === allNetworkId) {
          return false;
        }
        if (currentNetworkId === allNetworkId) {
          return !o.network.isTestnet && !o.vaultSetting.isSingleToken;
        }
        return !o.vaultSetting.isSingleToken;
      })
      .map((o) => o.network);
  }

  @backgroundMethod()
  async getCustomRpcEnabledNetworks() {
    const settings = await this._getNetworkVaultSettings();
    return settings
      .filter((o) => o.vaultSetting.customRpcEnabled)
      .map((o) => o.network);
  }

  @backgroundMethod()
  async getNetworkIdsCompatibleWithWalletId({
    walletId,
    networkIds,
  }: {
    walletId?: string;
    networkIds?: string[];
  }) {
    let networkVaultSettings = await this._getNetworkVaultSettings();
    if (networkIds) {
      const networkIdsSet = new Set<string>(networkIds);
      networkVaultSettings = networkVaultSettings.filter((o) =>
        networkIdsSet.has(o.network.id),
      );
    }

    networkVaultSettings = networkVaultSettings.filter(
      (o) => !networkUtils.isAllNetwork({ networkId: o.network.id }),
    );

    let networkIdsIncompatible: string[] = [];
    if (walletId) {
      const isHwWallet = accountUtils.isHwWallet({ walletId });
      const isHdWallet = accountUtils.isHdWallet({ walletId });
      const isWatchingWallet = accountUtils.isWatchingWallet({ walletId });
      const isExternalWallet = accountUtils.isExternalWallet({
        walletId,
      });
      const isImportedWallet = accountUtils.isImportedWallet({
        walletId,
      });

      if (isHwWallet) {
        const walletDevice =
          await this.backgroundApi.serviceAccount.getWalletDeviceSafe({
            walletId,
          });
        if (walletDevice) {
          // Filter by device type
          const networksDeviceTypeDisabled = networkVaultSettings
            .filter((o) => {
              const deviceTypes = o.vaultSetting.supportedDeviceTypes;
              if (deviceTypes && deviceTypes.length > 0) {
                return !deviceTypes.includes(walletDevice.deviceType);
              }
              return false;
            })
            .map((o) => o.network.id);
          networkIdsIncompatible = networkIdsIncompatible.concat(
            networksDeviceTypeDisabled,
          );

          // Filter by firmware type (Bitcoin Only, etc.)
          const wallet = await this.backgroundApi.serviceAccount.getWalletSafe({
            walletId,
            withoutRefill: true,
          });
          if (wallet?.firmwareTypeAtCreated === EFirmwareType.BitcoinOnly) {
            // Bitcoin Only firmware: only allow BTC implementation networks
            const nonBtcNetworks = networkVaultSettings
              .filter((o) => o.network.impl !== IMPL_BTC)
              .map((o) => o.network.id);
            networkIdsIncompatible =
              networkIdsIncompatible.concat(nonBtcNetworks);
          }
        }
      } else if (isHdWallet) {
        // is software wallet
        const networksSoftwareAccountDisabled = networkVaultSettings
          .filter((o) => o.vaultSetting.softwareAccountDisabled)
          .map((o) => o.network.id);
        networkIdsIncompatible = networkIdsIncompatible.concat(
          networksSoftwareAccountDisabled,
        );
      } else if (isWatchingWallet) {
        const networksWatchingWalletDisabled = networkVaultSettings
          .filter((o) => !o.vaultSetting.watchingAccountEnabled)
          .map((o) => o.network.id);
        networkIdsIncompatible = networkIdsIncompatible.concat(
          networksWatchingWalletDisabled,
        );
      } else if (isExternalWallet) {
        const networksExternalWalletDisabled = networkVaultSettings
          .filter((o) => !o.vaultSetting.externalAccountEnabled)
          .map((o) => o.network.id);
        networkIdsIncompatible = networkIdsIncompatible.concat(
          networksExternalWalletDisabled,
        );
      } else if (isImportedWallet) {
        const networksImportedWalletDisabled = networkVaultSettings
          .filter((o) => !o.vaultSetting.importedAccountEnabled)
          .map((o) => o.network.id);
        networkIdsIncompatible = networkIdsIncompatible.concat(
          networksImportedWalletDisabled,
        );
      }

      const isQrWallet = accountUtils.isQrWallet({ walletId });
      if (isQrWallet) {
        const networksQrAccountDisabled = networkVaultSettings
          .filter((o) => {
            const isQrAccountSupported = o.vaultSetting.qrAccountEnabled;
            return !isQrAccountSupported;
          })
          .map((o) => o.network.id);
        networkIdsIncompatible = networkIdsIncompatible.concat(
          networksQrAccountDisabled,
        );

        const walletDevice =
          await this.backgroundApi.serviceAccount.getWalletDeviceSafe({
            walletId,
          });

        if (walletDevice) {
          // Filter by firmware type (Bitcoin Only, etc.)
          const wallet = await this.backgroundApi.serviceAccount.getWalletSafe({
            walletId,
            withoutRefill: true,
          });
          if (wallet?.firmwareTypeAtCreated === EFirmwareType.BitcoinOnly) {
            // Bitcoin Only firmware: only allow BTC implementation networks
            const nonBtcNetworks = networkVaultSettings
              .filter((o) => o.network.impl !== IMPL_BTC)
              .map((o) => o.network.id);
            networkIdsIncompatible =
              networkIdsIncompatible.concat(nonBtcNetworks);
          }
        }
        // Qr account only support btc/evm network
      }
    }

    return {
      networkIdsIncompatible,
      networkIdsCompatible: networkVaultSettings
        .map((o) => o.network.id)
        .filter((networkId) => !networkIdsIncompatible.includes(networkId)),
    };
  }

  @backgroundMethod()
  async getImplContainsMultipleNetworks() {
    const presetNetworks = getPresetNetworks();

    const impls: {
      [impl: string]: IServerNetwork[];
    } = {};
    presetNetworks.forEach((o) => {
      impls[o.impl] = impls[o.impl] || [];
      impls[o.impl].push(o);
    });
    const results: {
      [impl: string]: IServerNetwork[];
    } = {};
    Object.entries(impls).forEach(([impl, networks]) => {
      if (networks.length > 1) {
        results[impl] = networks;
      }
    });
    return results;
  }

  @backgroundMethod()
  async getChainSelectorNetworksCompatibleWithAccountId({
    accountId,
    networkIds,
    walletId: _walletId,
    clearCache,
    excludeTestNetwork,
  }: {
    accountId?: string;
    walletId?: string;
    networkIds?: string[];
    clearCache?: boolean;
    excludeTestNetwork?: boolean;
    useDefaultPinnedNetworks?: boolean;
  }): Promise<{
    mainnetItems: IServerNetwork[];
    testnetItems: IServerNetwork[];
    unavailableItems: IServerNetwork[];
    frequentlyUsedItems: IServerNetwork[];
    allNetworkItem?: IServerNetwork;
    useDefaultPinnedNetworks?: boolean;
  }> {
    if (clearCache) {
      await this._getNetworkVaultSettings.clear();
    }

    let networkVaultSettings = await this._getNetworkVaultSettings();
    if (networkIds) {
      const networkIdsSet = new Set<string>(networkIds);
      networkVaultSettings = networkVaultSettings.filter((o) =>
        networkIdsSet.has(o.network.id),
      );
    }

    networkVaultSettings = networkVaultSettings.filter(
      (o) => !networkUtils.isAllNetwork({ networkId: o.network.id }),
    );

    let dbAccount: IDBAccount | undefined;
    let networkIdsDisabled: string[] = [];
    let walletId: string | undefined = _walletId;

    if (accountId) {
      dbAccount = await this.backgroundApi.serviceAccount.getDBAccountSafe({
        accountId,
      });
      if (!walletId) {
        walletId = accountUtils.getWalletIdFromAccountId({ accountId });
      }
    }
    if (walletId) {
      const compatibleResp = await this.getNetworkIdsCompatibleWithWalletId({
        networkIds,
        walletId,
      });
      networkIdsDisabled = compatibleResp.networkIdsIncompatible;
    }

    const networkIdsDisabledSet = new Set(networkIdsDisabled);

    const isAccountCompatibleWithNetwork = (params: {
      account?: IDBAccount;
      networkId: string;
    }) => {
      if (networkIdsDisabledSet.has(params.networkId)) {
        return false;
      }
      if (
        params.account &&
        accountUtils.isOthersAccount({ accountId: params.account.id })
      ) {
        return accountUtils.isAccountCompatibleWithNetwork({
          account: params.account,
          networkId: params.networkId,
        });
      }
      return true;
    };

    const _networks = networkVaultSettings.map((o) => o.network);

    const _frequentlyUsed =
      await this.backgroundApi.serviceNetwork.getNetworkSelectorPinnedNetworks({
        useDefaultPinnedNetworks: true,
      });

    const allNetworkItem =
      await this.backgroundApi.serviceNetwork.getNetworkSafe({
        networkId: getNetworkIdsMap().onekeyall,
      });

    if (allNetworkItem) {
      allNetworkItem.name = appLocale.intl.formatMessage({
        id: ETranslations.global_all_networks,
      });
    }
    let unavailableNetworks: IServerNetwork[] = [];
    const frequentlyUsedNetworks: IServerNetwork[] = [];
    const networks: IServerNetwork[] = [];

    for (let i = 0; i < _frequentlyUsed.length; i += 1) {
      const item = _frequentlyUsed[i];
      if (
        isAccountCompatibleWithNetwork({
          account: dbAccount,
          networkId: item.id,
        })
      ) {
        frequentlyUsedNetworks.push(item);
      } else {
        unavailableNetworks.push(item);
      }
    }
    for (let i = 0; i < _networks.length; i += 1) {
      const item = _networks[i];
      if (
        isAccountCompatibleWithNetwork({
          account: dbAccount,
          networkId: item.id,
        })
      ) {
        networks.push(item);
      } else {
        unavailableNetworks.push(item);
      }
    }

    const unavailableNetworkIds: Set<string> = new Set<string>();
    unavailableNetworks = unavailableNetworks.filter((o) => {
      const isDuplicate = unavailableNetworkIds.has(o.id);
      if (!isDuplicate) {
        unavailableNetworkIds.add(o.id);
      }
      return !isDuplicate;
    });

    if (excludeTestNetwork) {
      return {
        mainnetItems: networks.filter((o) => !o.isTestnet),
        testnetItems: [],
        frequentlyUsedItems: frequentlyUsedNetworks.filter((o) => !o.isTestnet),
        unavailableItems: unavailableNetworks.filter((o) => !o.isTestnet),
        allNetworkItem,
      };
    }

    return {
      mainnetItems: networks.filter((o) => !o.isTestnet),
      testnetItems: networks.filter((o) => o.isTestnet),
      frequentlyUsedItems: frequentlyUsedNetworks,
      unavailableItems: unavailableNetworks,
      allNetworkItem,
    };
  }

  @backgroundMethod()
  async isCustomNetwork({ networkId }: { networkId: string }) {
    const network = await this.backgroundApi.serviceNetwork.getNetwork({
      networkId,
    });
    return !!network.isCustomNetwork;
  }

  @backgroundMethod()
  async clearNetworkVaultSettingsCache() {
    void this._getNetworkVaultSettings.clear();
  }

  @backgroundMethod()
  async clearAllNetworksCache() {
    void this.getAllNetworksWithCache.clear();
  }

  @backgroundMethod()
  async getRecentNetworks({
    limit,
    availableNetworks,
  }: {
    limit?: number;
    availableNetworks?: IServerNetwork[];
  } = {}) {
    return this.backgroundApi.simpleDb.recentNetworks.getRecentNetworks({
      limit,
      availableNetworks,
    });
  }

  @backgroundMethod()
  async updateRecentNetworks(data: Record<string, { updatedAt: number }>) {
    if (!data) {
      return;
    }

    // filter out all network
    const filteredData = Object.fromEntries(
      Object.entries(data).filter(
        ([networkId]) => !networkUtils.isAllNetwork({ networkId }),
      ),
    );

    return this.backgroundApi.simpleDb.recentNetworks.updateRecentNetworks(
      filteredData,
    );
  }

  @backgroundMethod()
  async updateRecentNetwork({ networkId }: { networkId: string }) {
    if (!networkId || networkUtils.isAllNetwork({ networkId })) {
      return;
    }
    const timestamp = Date.now();
    return this.backgroundApi.simpleDb.recentNetworks.updateRecentNetworks({
      [networkId]: { updatedAt: timestamp },
    });
  }

  @backgroundMethod()
  async clearRecentNetworks() {
    return this.backgroundApi.simpleDb.recentNetworks.clearRecentNetworks();
  }

  @backgroundMethod()
  async deleteRecentNetwork({ networkId }: { networkId: string }) {
    return this.backgroundApi.simpleDb.recentNetworks.deleteRecentNetwork({
      networkId,
    });
  }

  @backgroundMethod()
  async sortChainSelectorNetworksByValue({
    walletId,
    chainSelectorNetworks,
    accountNetworkValues,
    localDeFiOverview,
  }: {
    walletId: string;
    chainSelectorNetworks: {
      mainnetItems: IServerNetwork[];
      testnetItems: IServerNetwork[];
      frequentlyUsedItems: IServerNetwork[];
      unavailableItems: IServerNetwork[];
      allNetworkItem?: IServerNetwork;
    };
    accountNetworkValues: Record<string, string>;
    localDeFiOverview: Record<
      string,
      {
        netWorth: number;
      }
    >;
  }) {
    if (isEmpty(accountNetworkValues) && isEmpty(localDeFiOverview)) {
      return {
        chainSelectorNetworks,
        formattedAccountNetworkValues: {},
        accountDeFiOverview: {},
      };
    }

    const networkInfoMap: Record<
      string,
      { deriveType: IAccountDeriveTypes; mergeDeriveAssetsEnabled: boolean }
    > = {};

    const formattedAccountNetworkValues: Record<string, string> = {};
    const allAccountValues: Record<string, string> = {};

    const deriveTypeRawData =
      await this.backgroundApi.simpleDb.accountSelector.getRawData();

    for (const [key, value] of Object.entries(accountNetworkValues)) {
      const keyArray = key.split('_');
      const networkId = keyArray.pop() as string;
      const accountId = keyArray.join('_');
      const [_walletId, _path, _deriveType] = accountId.split(SEPERATOR) as [
        string,
        string,
        string,
      ];

      const deriveType: IAccountDeriveTypes =
        (_deriveType as IAccountDeriveTypes) || 'default';

      if (!networkInfoMap[networkId]) {
        const [globalDeriveType, vaultSettings] = await Promise.all([
          this.backgroundApi.serviceNetwork.getGlobalDeriveTypeOfNetwork({
            networkId,
            rawData: deriveTypeRawData,
          }),
          this.backgroundApi.serviceNetwork.getVaultSettings({ networkId }),
        ]);
        networkInfoMap[networkId] = {
          deriveType: globalDeriveType,
          mergeDeriveAssetsEnabled:
            vaultSettings.mergeDeriveAssetsEnabled ?? false,
        };
      }
      if (
        walletId === _walletId &&
        networkInfoMap[networkId] &&
        (networkInfoMap[networkId].mergeDeriveAssetsEnabled ||
          accountUtils.isOthersAccount({ accountId }) ||
          networkInfoMap[networkId].deriveType.toLowerCase() ===
            deriveType.toLowerCase())
      ) {
        if (isNil(formattedAccountNetworkValues[networkId])) {
          allAccountValues[networkId] = new BigNumber(
            localDeFiOverview[networkId]?.netWorth ?? 0,
          )
            .plus(value)
            .toFixed();
          formattedAccountNetworkValues[networkId] = value;
        } else {
          formattedAccountNetworkValues[networkId] = new BigNumber(
            formattedAccountNetworkValues[networkId],
          )
            .plus(value)
            .toFixed();
          allAccountValues[networkId] = new BigNumber(
            allAccountValues[networkId],
          )
            .plus(value)
            .plus(localDeFiOverview[networkId]?.netWorth ?? 0)
            .toFixed();
        }
      }
    }

    // if network in frequentlyUsedItems do not has value or value is less than 1 usd, remove it from frequentlyUsedItems
    let frequentlyUsedItems = chainSelectorNetworks.frequentlyUsedItems.filter(
      (item) => {
        return new BigNumber(allAccountValues[item.id] ?? '0').gt(
          NETWORK_SHOW_VALUE_THRESHOLD_USD,
        );
      },
    );

    // check if any network in mainnetItems has non-zero value, add it to frequentlyUsedItems
    for (const item of chainSelectorNetworks.mainnetItems) {
      if (
        new BigNumber(allAccountValues[item.id] ?? '0').gt(
          NETWORK_SHOW_VALUE_THRESHOLD_USD,
        )
      ) {
        frequentlyUsedItems.push(item);
      }
    }

    if (isEmpty(frequentlyUsedItems)) {
      return {
        chainSelectorNetworks,
        formattedAccountNetworkValues,
        accountDeFiOverview: localDeFiOverview,
      };
    }

    // uniq frequentlyUsedItems and sort by value
    frequentlyUsedItems = uniqBy(frequentlyUsedItems, 'id').sort((a, b) => {
      return new BigNumber(allAccountValues[b.id] ?? '0').comparedTo(
        new BigNumber(allAccountValues[a.id] ?? '0'),
      );
    });

    return {
      chainSelectorNetworks: {
        ...chainSelectorNetworks,
        frequentlyUsedItems,
      },
      formattedAccountNetworkValues,
      accountDeFiOverview: localDeFiOverview,
    };
  }

  getCoreApiByNetwork({
    networkId,
  }: {
    networkId: string;
  }): CoreChainScopeBase {
    const impl = networkUtils.getNetworkImpl({ networkId });
    const coreApi = getCoreChainApiScopeByImpl({ impl });
    if (!coreApi) {
      throw new OneKeyLocalError(`No coreApi found for networkId ${networkId}`);
    }
    return coreApi;
  }
}

export default ServiceNetwork;
