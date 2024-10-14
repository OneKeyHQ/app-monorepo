import { flatten, groupBy, isEqual } from 'lodash';
import semver from 'semver';

import {
  isTaprootAddress,
  isTaprootPath,
} from '@onekeyhq/core/src/chains/btc/sdkBtc';
import type { IAccountSelectorAvailableNetworksMap } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { ICurrencyItem } from '@onekeyhq/kit/src/views/Setting/pages/Currency';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  IMPL_BTC,
  IMPL_EVM,
  IMPL_LTC,
} from '@onekeyhq/shared/src/engine/engineConsts';
import type { ILocaleSymbol } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import {
  getDefaultLocale,
  getLocaleMessages,
} from '@onekeyhq/shared/src/locale/getDefaultLocale';
import systemLocaleUtils from '@onekeyhq/shared/src/locale/systemLocale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { clearPackage } from '@onekeyhq/shared/src/modules3rdParty/auto-update';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import resetUtils from '@onekeyhq/shared/src/utils/resetUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import {
  EReasonForNeedPassword,
  type IClearCacheOnAppState,
} from '@onekeyhq/shared/types/setting';
import { ESwapTxHistoryStatus } from '@onekeyhq/shared/types/swap/types';

import { currencyPersistAtom } from '../states/jotai/atoms';
import {
  settingsLastActivityAtom,
  settingsPersistAtom,
} from '../states/jotai/atoms/settings';

import ServiceBase from './ServiceBase';

export type IAccountDerivationConfigItem = {
  num: number;
  title: string;
  icon?: string;
  defaultNetworkId: string;
};

@backgroundClass()
class ServiceSetting extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  async refreshLocaleMessages() {
    const locale = await this.getCurrentLocale();
    const messages = await getLocaleMessages(locale);
    appLocale.setLocale(locale, messages as any);
  }

  @backgroundMethod()
  public async setTheme(theme: 'light' | 'dark' | 'system') {
    const currentSettings = await settingsPersistAtom.get();
    if (currentSettings.theme === theme) {
      return;
    }
    await settingsPersistAtom.set((prev) => ({ ...prev, theme }));
  }

  @backgroundMethod()
  public async setLocale(locale: ILocaleSymbol) {
    const currentSettings = await settingsPersistAtom.get();
    if (currentSettings.locale === locale) {
      return;
    }
    await settingsPersistAtom.set((prev) => ({ ...prev, locale }));
    await this.refreshLocaleMessages();
  }

  @backgroundMethod()
  public async getCurrentLocale() {
    const { locale } = await settingsPersistAtom.get();

    if (locale === 'system') {
      return getDefaultLocale();
    }

    return locale;
  }

  @backgroundMethod()
  public async getInstanceId() {
    const { instanceId } = await settingsPersistAtom.get();
    return instanceId;
  }

  @backgroundMethod()
  public async setProtectCreateTransaction(value: boolean) {
    await this.backgroundApi.servicePassword.promptPasswordVerify({
      reason: EReasonForNeedPassword.Security,
    });
    await settingsPersistAtom.set((prev) => ({
      ...prev,
      protectCreateTransaction: value,
    }));
  }

  @backgroundMethod()
  public async setProtectCreateOrRemoveWallet(value: boolean) {
    await this.backgroundApi.servicePassword.promptPasswordVerify({
      reason: EReasonForNeedPassword.Security,
    });
    await settingsPersistAtom.set((prev) => ({
      ...prev,
      protectCreateOrRemoveWallet: value,
    }));
  }

  @backgroundMethod()
  public async setBiologyAuthSwitchOn(value: boolean) {
    await settingsPersistAtom.set((prev) => ({
      ...prev,
      isBiologyAuthSwitchOn: value,
    }));
  }

  @backgroundMethod()
  public async getBiologyAuthSwitchOn() {
    const { isBiologyAuthSwitchOn } = await settingsPersistAtom.get();
    return isBiologyAuthSwitchOn;
  }

  @backgroundMethod()
  public async setSpendDustUTXO(value: boolean) {
    await settingsPersistAtom.set((prev) => ({
      ...prev,
      spendDustUTXO: value,
    }));
  }

  @backgroundMethod()
  public async refreshLastActivity() {
    if (resetUtils.getIsResetting()) {
      return;
    }
    await settingsLastActivityAtom.set((prev) => ({
      ...prev,
      time: Date.now(),
    }));
  }

  _getCurrencyList = memoizee(
    async () => {
      const client = await this.getClient(EServiceEndpointEnum.Utility);
      const res = await client.get<{ data: ICurrencyItem[] }>(
        '/utility/v1/currency/exchange-rates',
      );
      return res.data.data;
    },
    {
      promise: true,
      maxAge: timerUtils.getTimeDurationMs({ minute: 5 }),
    },
  );

  @backgroundMethod()
  public async initSystemLocale() {
    if (!platformEnv.isExtensionBackground) return;
    await systemLocaleUtils.initSystemLocale();
    getDefaultLocale.clear();
  }

  @backgroundMethod()
  public async getCurrencyList(): Promise<ICurrencyItem[]> {
    return this._getCurrencyList();
  }

  @backgroundMethod()
  public async fetchCurrencyList() {
    const currencyItems = await this._getCurrencyList();
    await currencyPersistAtom.set({
      currencyItems,
    });
  }

  @backgroundMethod()
  public async setCurrency(currencyInfo: { id: string; symbol: string }) {
    const currentSettings = await settingsPersistAtom.get();
    if (isEqual(currentSettings.currencyInfo, currencyInfo)) {
      return;
    }
    await settingsPersistAtom.set((prev) => ({ ...prev, currencyInfo }));
  }

  @backgroundMethod()
  public async clearCacheOnApp(values: IClearCacheOnAppState) {
    if (values.tokenAndNFT) {
      // clear token and nft
      await this.backgroundApi.simpleDb.localTokens.clearRawData();
      await this.backgroundApi.simpleDb.localNFTs.clearRawData();
    }
    if (values.transactionHistory) {
      // clear transaction history
      await this.backgroundApi.simpleDb.localHistory.clearRawData();
    }
    if (values.swapHistory) {
      // clear swap history
      await this.backgroundApi.serviceSwap.cleanSwapHistoryItems();
    }
    if (values.browserCache) {
      await this.backgroundApi.serviceDiscovery.clearCache();
    }
    if (values.appUpdateCache) {
      await this.backgroundApi.serviceAppUpdate.clearCache();
    }
    if (values.browserHistory) {
      // clear Browser History, Bookmarks, Pins
      await this.backgroundApi.simpleDb.browserTabs.clearRawData();
      await this.backgroundApi.simpleDb.browserHistory.clearRawData();
      await this.backgroundApi.simpleDb.browserBookmarks.clearRawData();
      await this.backgroundApi.simpleDb.browserRiskWhiteList.clearRawData();
      this.backgroundApi.serviceDiscovery._isUrlExistInRiskWhiteList.clear();
    }
    if (values.connectSites) {
      // clear connect sites
      await this.backgroundApi.simpleDb.dappConnection.clearRawData();
    }
    if (values.signatureRecord) {
      // clear signature record
      await this.backgroundApi.serviceSignature.deleteAllSignatureRecords();
    }
    if (values.customToken) {
      await this.backgroundApi.simpleDb.customTokens.clearRawData();
    }
    if (values.customRpc) {
      await this.backgroundApi.simpleDb.customRpc.clearRawData();
    }
    if (values.serverNetworks) {
      await this.backgroundApi.simpleDb.serverNetwork.clearRawData();
    }
    defaultLogger.setting.page.clearData({ action: 'Cache' });
  }

  @backgroundMethod()
  public async clearPendingTransaction() {
    await this.backgroundApi.serviceHistory.clearLocalHistoryPendingTxs();
    await this.backgroundApi.serviceSwap.cleanSwapHistoryItems([
      ESwapTxHistoryStatus.CANCELING,
      ESwapTxHistoryStatus.PENDING,
    ]);
    defaultLogger.setting.page.clearData({ action: 'Pending txn' });
  }

  @backgroundMethod()
  public async getAccountDerivationConfig() {
    const { serviceNetwork } = this.backgroundApi;
    const allNetworks =
      await this.backgroundApi.serviceNetwork.getAllNetworks();
    let { networks } = allNetworks;
    const mainNetworks = networks.filter((o) => !o.isTestnet);

    const networkGroup = groupBy(mainNetworks, (item) => item.impl);
    networks = flatten(Object.values(networkGroup).map((o) => o[0]));

    const networksVaultSettings = await Promise.all(
      networks.map((o) => serviceNetwork.getVaultSettings({ networkId: o.id })),
    );

    if (networksVaultSettings.length !== networks.length) {
      throw new Error('failed to get account derivation config');
    }

    networks = networks.filter((o, i) => {
      const vaultSettings = networksVaultSettings[i];
      return Object.values(vaultSettings.accountDeriveInfo).length > 1;
    });

    const toppedImpl = [IMPL_BTC, IMPL_EVM, IMPL_LTC].reduce(
      (result, o, index) => {
        result[o] = index;
        return result;
      },
      {} as Record<string, number>,
    );

    const topped: IServerNetwork[] = [];
    const bottomed: IServerNetwork[] = [];

    for (let i = 0; i < networks.length; i += 1) {
      const network = networks[i];
      if (toppedImpl[network.impl] !== undefined) {
        topped.push(network);
      } else {
        bottomed.push(network);
      }
    }

    topped.sort((a, b) => toppedImpl[a.impl] ?? 0 - toppedImpl[b.impl] ?? 0);

    networks = [...topped, ...bottomed];
    const networkIds = networks.map((n) => n.id);

    const config: IAccountDerivationConfigItem[] = networks.map(
      (network, i) => ({
        num: i,
        title: network.impl === IMPL_EVM ? 'EVM' : network.name,
        icon: network?.logoURI,
        defaultNetworkId: network.id,
      }),
    );

    // const config: IAccountDerivationConfigItem[] = [];

    const tbtc = allNetworks.networks.find(
      (n) => n.id === getNetworkIdsMap().tbtc,
    );

    if (platformEnv.isDev && tbtc) {
      config.push({
        num: 10_000,
        title: 'Test Bitcoin',
        icon: tbtc?.logoURI,
        defaultNetworkId: getNetworkIdsMap().tbtc,
      });
    }
    const data = {
      enabledNum: config.map((o) => o.num),
      availableNetworksMap: config.reduce((result, item) => {
        result[item.num] = {
          defaultNetworkId: item.defaultNetworkId,
        };
        return result;
      }, {} as IAccountSelectorAvailableNetworksMap),
      items: config,
    };
    return data;
  }

  @backgroundMethod()
  public async addConfirmedRiskTokens(tokens: string[]) {
    await this.backgroundApi.simpleDb.riskyTokens.addConfirmedRiskTokens(
      tokens,
    );
  }

  @backgroundMethod()
  public async checkConfirmedRiskToken(tokenId: string) {
    const confirmedRiskTokens =
      await this.backgroundApi.simpleDb.riskyTokens.getConfirmedRiskTokens();
    return confirmedRiskTokens.includes(tokenId);
  }

  @backgroundMethod()
  public async fetchReviewControl() {
    const isReviewControlEnv = platformEnv.isAppleStoreEnv || platformEnv.isMas;
    if (isReviewControlEnv) {
      const client = await this.getClient(EServiceEndpointEnum.Utility);
      const key = platformEnv.isAppleStoreEnv
        ? 'Intelligent_Diligent_Resourceful_Capable'
        : 'Mindful_Driven_Responsible_Curious';
      const response = await client.get<{
        data: { value: string; key: string }[];
      }>('/utility/v1/setting', {
        params: {
          key,
        },
      });
      const data = response.data.data;
      let show = true;
      if (data.length === 1 && data[0].key === key) {
        const reviewVersion = data[0].value;
        const clientVersion = platformEnv.version;
        if (reviewVersion && clientVersion) {
          show = semver.lte(clientVersion, reviewVersion);
        }
      }
      await settingsPersistAtom.set((prev) => ({
        ...prev,
        reviewControl: show,
      }));
    }
  }

  @backgroundMethod()
  public async getInscriptionProtection() {
    const { inscriptionProtection } = await settingsPersistAtom.get();
    return inscriptionProtection;
  }

  @backgroundMethod()
  public async checkInscriptionProtectionEnabled({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }) {
    if (!networkId || !accountId) {
      return false;
    }
    if (!networkUtils.isBTCNetwork(networkId)) {
      return false;
    }
    const account = await this.backgroundApi.serviceAccount.getAccount({
      networkId,
      accountId,
    });
    return isTaprootPath(account.path) || isTaprootAddress(account.address);
  }
}

export default ServiceSetting;
