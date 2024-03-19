import { isFunction } from 'lodash';

import type { IAccountSelectorAvailableNetworksMap } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { ICurrencyItem } from '@onekeyhq/kit/src/views/Setting/pages/Currency';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import type { ILocaleSymbol } from '@onekeyhq/shared/src/locale';
import { LOCALES } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { getDefaultLocale } from '@onekeyhq/shared/src/locale/getDefaultLocale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { EOnekeyDomain } from '@onekeyhq/shared/types';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';
import type { IClearCacheOnAppState } from '@onekeyhq/shared/types/setting';

import {
  settingsLastActivityAtom,
  settingsPersistAtom,
} from '../states/jotai/atoms/settings';

import ServiceBase from './ServiceBase';

export type IAccountDerivationConfigItem = {
  num: number;
  title: string;
  icon?: string;
  networkIds: string[];
  defaultNetworkId: string;
};

@backgroundClass()
class ServiceSetting extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  async refreshLocaleMessages() {
    const { locale: rawLocale } = await settingsPersistAtom.get();
    const locale: ILocaleSymbol =
      rawLocale === 'system' ? getDefaultLocale() : rawLocale;

    const messagesBuilder = await (LOCALES[locale] as unknown as Promise<
      (() => Promise<Record<string, string>>) | Promise<Record<string, string>>
    >);
    let messages: Record<string, string> = {};
    if (isFunction(messagesBuilder)) {
      messages = await messagesBuilder();
    } else {
      messages = messagesBuilder;
    }
    appLocale.setLocale(locale, messages);
  }

  @backgroundMethod()
  public async setTheme(theme: 'light' | 'dark' | 'system') {
    await settingsPersistAtom.set((prev) => ({ ...prev, theme }));
  }

  @backgroundMethod()
  public async setLocale(locale: ILocaleSymbol) {
    await settingsPersistAtom.set((prev) => ({ ...prev, locale }));
    await this.refreshLocaleMessages();
  }

  @backgroundMethod()
  public async setProtectCreateTransaction(value: boolean) {
    await settingsPersistAtom.set((prev) => ({
      ...prev,
      protectCreateTransaction: value,
    }));
  }

  @backgroundMethod()
  public async setProtectCreateOrRemoveWallet(value: boolean) {
    await settingsPersistAtom.set((prev) => ({
      ...prev,
      protectCreateOrRemoveWallet: value,
    }));
  }

  @backgroundMethod()
  public async setSpendDustUTXO(value: boolean) {
    await settingsPersistAtom.set((prev) => ({
      ...prev,
      spendDustUTXO: value,
    }));
  }

  @backgroundMethod()
  public async setHardwareConnectSrc(value: EOnekeyDomain) {
    await settingsPersistAtom.set((prev) => ({
      ...prev,
      hardwareConnectSrc: value,
    }));
  }

  @backgroundMethod()
  public async refreshLastActivity() {
    await settingsLastActivityAtom.set((prev) => ({
      ...prev,
      time: Date.now(),
    }));
  }

  _getCurrencyList = memoizee(
    async () => {
      const client = await this.getClient();
      const res = await client.get<{ data: ICurrencyItem[] }>(
        '/gateway/v1/currency/list',
      );
      return res.data.data;
    },
    {
      promise: true,
      maxAge: timerUtils.getTimeDurationMs({ minute: 5 }),
    },
  );

  @backgroundMethod()
  public async getCurrencyList(): Promise<ICurrencyItem[]> {
    return this._getCurrencyList();
  }

  @backgroundMethod()
  public async setCurrency(currencyInfo: { id: string; symbol: string }) {
    await settingsPersistAtom.set((prev) => ({ ...prev, currencyInfo }));
  }

  @backgroundMethod()
  public async clearCacheOnApp(values: IClearCacheOnAppState) {
    if (values.tokenAndNFT) {
      // clear token and nft
    }
    if (values.transactionHistory) {
      // clear transaction history
    }
    if (values.swapHistory) {
      // clear swap history
    }
    if (values.browserCache) {
      // clear browser cache
    }
    if (values.browserHistory) {
      // clear Browser History, Bookmarks, Pins
      await this.backgroundApi.simpleDb.browserTabs.clearRawData();
      await this.backgroundApi.simpleDb.browserHistory.clearRawData();
      await this.backgroundApi.simpleDb.browserBookmarks.clearRawData();
    }
    if (values.connectSites) {
      // clear connect sites
      await this.backgroundApi.simpleDb.dappConnection.clearRawData();
    }
  }

  @backgroundMethod()
  public async clearPendingTransaction() {
    // TODO: clear pending transaction
  }

  @backgroundMethod()
  public async getAccountDerivationConfig() {
    const networks = await this.backgroundApi.serviceNetwork.getAllNetworks();
    const networkIds = networks.networks.map((n) => n.id);
    const btc = networks.networks.find((n) => n.id === getNetworkIdsMap().btc);
    const eth = networks.networks.find((n) => n.id === getNetworkIdsMap().eth);
    const ltc = networks.networks.find((n) => n.id === getNetworkIdsMap().ltc);
    const tbtc = networks.networks.find(
      (n) => n.id === getNetworkIdsMap().tbtc,
    );
    const config: IAccountDerivationConfigItem[] = [
      {
        num: 0,
        title: 'Bitcoin',
        icon: btc?.logoURI,
        networkIds,
        defaultNetworkId: getNetworkIdsMap().btc,
      },
      {
        num: 1,
        title: 'EVM',
        icon: eth?.logoURI,
        networkIds,
        defaultNetworkId: getNetworkIdsMap().eth,
      },
      {
        num: 2,
        title: 'Litecoin',
        icon: ltc?.logoURI,
        networkIds,
        defaultNetworkId: getNetworkIdsMap().ltc,
      },
    ];
    if (platformEnv.isDev) {
      config.push({
        num: 10000,
        title: 'Test Bitcoin',
        icon: tbtc?.logoURI,
        networkIds,
        defaultNetworkId: getNetworkIdsMap().tbtc,
      });
    }
    return {
      enabledNum: config.map((o) => o.num),
      availableNetworksMap: config.reduce((result, item) => {
        result[item.num] = {
          networkIds: item.networkIds,
          defaultNetworkId: item.defaultNetworkId,
        };
        return result;
      }, {} as IAccountSelectorAvailableNetworksMap),
      items: config,
    };
  }

  @backgroundMethod()
  public async isAlwaysReenterPassword(
    reason?: EReasonForNeedPassword,
  ): Promise<boolean> {
    const isPasswordSet =
      await this.backgroundApi.servicePassword.checkPasswordSet();
    if (!reason || !isPasswordSet) {
      return false;
    }
    const { protectCreateOrRemoveWallet, protectCreateTransaction } =
      await settingsPersistAtom.get();

    return (
      (reason === EReasonForNeedPassword.CreateOrRemoveWallet &&
        protectCreateOrRemoveWallet) ||
      (reason === EReasonForNeedPassword.CreateTransaction &&
        protectCreateTransaction)
    );
  }
}

export default ServiceSetting;
