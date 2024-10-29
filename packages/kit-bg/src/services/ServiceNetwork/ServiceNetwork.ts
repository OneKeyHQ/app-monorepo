import { uniq, uniqBy } from 'lodash';

import {
  type EAddressEncodings,
  ECoreApiExportedSecretKeyType,
} from '@onekeyhq/core/src/types';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { getPresetNetworks } from '@onekeyhq/shared/src/config/presetNetworks';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { vaultFactory } from '../../vaults/factory';
import {
  getVaultSettings,
  getVaultSettingsAccountDeriveInfo,
} from '../../vaults/settings';
import ServiceBase from '../ServiceBase';

import type { IDBAccount } from '../../dbs/local/types';
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
    } = {},
  ): Promise<{ networks: IServerNetwork[] }> {
    // TODO save to simpleDB
    const excludeTestNetwork = params?.excludeTestNetwork ?? false;
    const uniqByImpl = params?.uniqByImpl ?? false;
    const excludeNetworkIds = params?.excludeNetworkIds ?? [];
    if (params.excludeAllNetworkItem) {
      excludeNetworkIds.push(getNetworkIdsMap().onekeyall);
    }

    const presetNetworks = getPresetNetworks();

    // Fetch server and custom networks
    const [serverNetworks, customNetworks] = await Promise.all([
      this.backgroundApi.serviceCustomRpc.getServerNetworks(),
      this.backgroundApi.serviceCustomRpc.getAllCustomNetworks(),
    ]);

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

    // Add networks in order of priority
    addNetworks(presetNetworks);
    addNetworks(serverNetworks);
    addNetworks(customNetworks);

    // Convert Map back to array
    let networks = Array.from(networkMap.values());
    if (params.excludeCustomNetwork) {
      excludeNetworkIds.push(...customNetworks.map((n) => n.id));
    }
    if (uniqByImpl) {
      networks = uniqBy(networks, (n) => n.impl);
    }
    if (excludeTestNetwork) {
      networks = networks.filter((n) => !n.isTestnet);
    }
    if (excludeNetworkIds?.length) {
      networks = networks.filter((n) => !excludeNetworkIds.includes(n.id));
    }
    return Promise.resolve({ networks });
  }

  @backgroundMethod()
  async getAllNetworkIds(): Promise<{ networkIds: string[] }> {
    const { networks } = await this.getAllNetworks();
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
      throw new Error(
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
    networkId,
    template,
  }: {
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
    const deriveInfo = deriveInfoItems.find(
      (item) => item.item.template === template,
    );
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
    account: IDBAccount;
  }) {
    const { template } = account;
    const deriveTypeData = await this.getDeriveTypeByTemplate({
      networkId,
      template,
    });
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
  async getNetworkSelectorPinnedNetworkIds() {
    const pinnedNetworkIds =
      await this.backgroundApi.simpleDb.networkSelector.getPinnedNetworkIds();
    const networkIds = pinnedNetworkIds ?? defaultPinnedNetworkIds;
    return networkIds;
  }

  @backgroundMethod()
  async getNetworkSelectorPinnedNetworks(): Promise<IServerNetwork[]> {
    let networkIds = await this.getNetworkSelectorPinnedNetworkIds();
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
  }: {
    networkId: string;
  }): Promise<IAccountDeriveTypes> {
    const currentGlobalDeriveType =
      await this.backgroundApi.simpleDb.accountSelector.getGlobalDeriveType({
        networkId,
      });
    return currentGlobalDeriveType ?? 'default';
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
  async getDeriveTypeByAddressEncoding({
    networkId,
    encoding,
  }: {
    networkId: string;
    encoding: EAddressEncodings;
  }): Promise<IAccountDeriveTypes | undefined> {
    const items = await this.getDeriveInfoItemsOfNetwork({ networkId });
    const deriveInfo = items.find(
      (item) => item.item.addressEncoding === encoding,
    );
    return deriveInfo?.value as IAccountDeriveTypes | undefined;
  }

  async getDeriveInfoByAddressEncoding({
    networkId,
    encoding,
  }: {
    networkId: string;
    encoding: EAddressEncodings;
  }) {
    const items = await this.getDeriveInfoItemsOfNetwork({ networkId });
    const deriveInfo = items.find(
      (item) => item.item.addressEncoding === encoding,
    );

    return deriveInfo;
  }

  async getAccountImportingDeriveTypes({
    networkId,
    input,
    validateAddress,
    validateXpub,
    validatePrivateKey,
    validateXprvt,
    template,
  }: {
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
    throw new Error('Not implemented');
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
  async getChainSelectorNetworksCompatibleWithAccountId({
    accountId,
    networkIds,
    walletId: _walletId,
  }: {
    accountId?: string;
    walletId?: string;
    networkIds?: string[];
  }): Promise<{
    mainnetItems: IServerNetwork[];
    testnetItems: IServerNetwork[];
    unavailableItems: IServerNetwork[];
    frequentlyUsedItems: IServerNetwork[];
    allNetworkItem?: IServerNetwork;
  }> {
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
      await this.backgroundApi.serviceNetwork.getNetworkSelectorPinnedNetworks();

    const allNetworkItem =
      await this.backgroundApi.serviceNetwork.getNetworkSafe({
        networkId: getNetworkIdsMap().onekeyall,
      });

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
}

export default ServiceNetwork;
