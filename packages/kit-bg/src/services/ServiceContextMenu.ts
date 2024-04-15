import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import ServiceBase from './ServiceBase';

import type {
  IDefaultWalletSettingsDB,
  IDefaultWalletSettingsWithLogo,
} from '../dbs/simple/entity/SimpleDbEntityDefaultWalletSettings';
import type ProviderApiPrivate from '../providers/ProviderApiPrivate';

const MenuId = 'OneKeyDefaultWalletItem';
@backgroundClass()
class ServiceContextMenu extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
    if (platformEnv.isExtensionBackground) {
      chrome.contextMenus.onClicked.addListener(this.listener);
      // update context menu when tab changed
      chrome.tabs.onActivated.addListener((activeInfo) => {
        chrome.tabs.get(activeInfo.tabId, (tab) => {
          if (tab?.url) {
            void this.updateContextMenu(new URL(tab.url).origin);
          }
        });
      });
    }
  }

  async init() {
    if (!platformEnv.isExtensionBackground) {
      return;
    }
    this.removeAll();
    chrome.contextMenus.create(
      {
        id: MenuId,
        title: await this.getContextMenuTitle(null),
        contexts: ['page'],
        documentUrlPatterns: [
          'https://*/*',
          'https://*/',
          'http://*/*',
          'http://*/',
        ],
      },
      () => {},
    );
  }

  private removeAll() {
    chrome.contextMenus.removeAll();
  }

  private listener = (
    info: chrome.contextMenus.OnClickData,
    tab?: chrome.tabs.Tab,
  ) => {
    if (!info.menuItemId) {
      return;
    }
    if (tab?.url) {
      try {
        const origin = new URL(tab.url).origin;
        void this.toggleDefaultWallet(origin);
      } catch {
        // ignore
      }
    }
  };

  private async updateContextMenu(origin: string, isDefaultWallet?: boolean) {
    chrome.contextMenus.update(MenuId, {
      title: await this.getContextMenuTitle(origin, isDefaultWallet),
    });
    setTimeout(() => {
      appEventBus.emit(EAppEventBusNames.ExtensionContextMenuUpdate, undefined);
    }, 100);
  }

  @backgroundMethod()
  async toggleDefaultWallet(origin: string) {
    const { simpleDb } = this.backgroundApi;
    const rawData = await simpleDb.defaultWalletSettings.getRawData();
    if (!rawData) {
      await this.addExcludedDApp(origin);
      await this.updateContextMenu(origin, false);
    } else {
      let shouldBeDefaultWallet = rawData.isDefaultWallet;
      if (!rawData.isDefaultWallet) {
        await this.setIsDefaultWallet(true);
        shouldBeDefaultWallet = true;
      }

      const isExcluded = rawData.excludeDappMap[origin];
      shouldBeDefaultWallet = isExcluded || !rawData.isDefaultWallet;
      if (shouldBeDefaultWallet) {
        await this.removeExcludedDApp(origin);
      } else {
        await this.addExcludedDApp(origin);
      }
      await this.updateContextMenu(origin, shouldBeDefaultWallet);
    }

    void this.notifyExtSwitchChanged(origin);
  }

  private shouldUpdate({
    origin,
    previousResult,
    currentResult,
  }: {
    origin: string;
    previousResult: IDefaultWalletSettingsWithLogo;
    currentResult: IDefaultWalletSettingsDB;
  }) {
    if (!previousResult || !currentResult) {
      return false;
    }
    // if rawData.isDefaultWallet is changed
    // Do not update if the current wallet is not the default and the dApp is already in the exclusion list
    if (previousResult.isDefaultWallet !== currentResult.isDefaultWallet) {
      if (Object.keys(currentResult.excludeDappMap).find((i) => i === origin)) {
        return false;
      }
      return true;
    }
    // Update if the status for the current origin in the excludedDappList differs between the current result and the previousResult
    if (
      currentResult.isDefaultWallet &&
      previousResult.excludedDappListWithLogo.find(
        (i) => i.origin === origin,
      ) !== Object.keys(currentResult.excludeDappMap).find((i) => i === origin)
    ) {
      return true;
    }
    return false;
  }

  @backgroundMethod()
  async updateAndNotify({
    origin,
    previousResult,
  }: {
    origin: string;
    previousResult: IDefaultWalletSettingsWithLogo;
  }) {
    const { simpleDb } = this.backgroundApi;
    const rawData = await simpleDb.defaultWalletSettings.getRawData();
    if (!rawData) {
      return;
    }
    if (
      this.shouldUpdate({
        origin,
        previousResult,
        currentResult: rawData,
      })
    ) {
      await this.updateContextMenu(origin, rawData.isDefaultWallet);
      void this.notifyExtSwitchChanged(origin);
    }
  }

  @backgroundMethod()
  public async getContextMenuTitle(
    origin: string | null,
    isDefaultWallet?: boolean,
  ) {
    if (!origin) {
      return 'Cancel the default on this dApp';
    }
    let defaultWallet: boolean;
    if (typeof isDefaultWallet === 'boolean') {
      defaultWallet = isDefaultWallet;
    } else {
      defaultWallet = await this.getIsDefaultWalletByOrigin(origin);
    }
    return defaultWallet
      ? 'Cancel the default on this dApp.'
      : 'Set OneKey as Default Wallet';
  }

  @backgroundMethod()
  async notifyExtSwitchChanged(origin: string) {
    const privateProvider = this.backgroundApi.providers
      .$private as ProviderApiPrivate;
    void privateProvider.notifyExtSwitchChanged({
      send: this.backgroundApi.sendForProvider('$private'),
      targetOrigin: origin,
    });
  }

  // --------------------- Default Wallet Settings --------------------
  @backgroundMethod()
  async setIsDefaultWallet(value: boolean) {
    return this.backgroundApi.simpleDb.defaultWalletSettings.setIsDefaultWallet(
      value,
    );
  }

  @backgroundMethod()
  async getIsDefaultWalletByOrigin(origin: string) {
    const rawData =
      await this.backgroundApi.simpleDb.defaultWalletSettings.getRawData();
    if (!rawData) {
      return true;
    }
    if (!rawData.isDefaultWallet) {
      return false;
    }
    if (rawData.excludeDappMap[origin]) {
      return false;
    }
    return true;
  }

  @backgroundMethod()
  async addExcludedDApp(origin: string) {
    if (!origin) {
      throw new Error('origin is required');
    }
    return this.backgroundApi.simpleDb.defaultWalletSettings.addExcludeDapp(
      origin,
    );
  }

  @backgroundMethod()
  async removeExcludedDApp(origin: string) {
    if (!origin) {
      throw new Error('origin is required');
    }
    return this.backgroundApi.simpleDb.defaultWalletSettings.removeExcludeDapp(
      origin,
    );
  }

  @backgroundMethod()
  async getDefaultWalletSettings() {
    const rawData =
      await this.backgroundApi.simpleDb.defaultWalletSettings.getRawData();
    if (!rawData) {
      return {
        isDefaultWallet: true,
        excludedDappList: [],
      };
    }
    return {
      isDefaultWallet: rawData.isDefaultWallet,
      excludedDappList: Object.keys(rawData.excludeDappMap),
    };
  }

  @backgroundMethod()
  async getDefaultWalletSettingsWithIcon(): Promise<IDefaultWalletSettingsWithLogo> {
    const result = await this.getDefaultWalletSettings();
    const excludedDappListWithLogo = await Promise.all(
      result.excludedDappList.map(async (i) => ({
        origin: i,
        logo: await this.backgroundApi.serviceDiscovery.buildWebsiteIconUrl(i),
      })),
    );
    return {
      isDefaultWallet: result.isDefaultWallet,
      excludedDappListWithLogo,
    };
  }
}

export default ServiceContextMenu;
