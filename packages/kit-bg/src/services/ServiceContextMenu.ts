import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceContextMenu extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
    if (platformEnv.isExtensionBackground) {
      console.log('=====>: isExtensionBackground');
      chrome.contextMenus.onClicked.addListener(this.listener);
      // 当标签页激活（切换）时，获取当前标签页并更新菜单
      chrome.tabs.onActivated.addListener((activeInfo) => {
        console.log('chrome.tabs.onActivated.addListener');
        chrome.tabs.get(activeInfo.tabId, (tab) => {
          console.log('chrome.tabs.get: ', tab);
        });
      });

      chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        console.log('=====>: tabId', tabId);
        console.log('=====>: changeInfo', changeInfo);
        console.log('=====>: tab', tab);
      });
    }
  }

  async init() {
    this.removeAll();
    console.log('====>>>Create menu');
    chrome.contextMenus.create(
      {
        id: 'OneKeyWalletItem',
        title: await this.getContextMenuTitle(null),
        contexts: ['all'],
      },
      () => {
        console.log('=====>>>: MENU CLICK');
      },
    );
  }

  private removeAll() {
    chrome.contextMenus.removeAll();
  }

  private listener = (
    info: chrome.contextMenus.OnClickData,
    tab?: chrome.tabs.Tab,
  ) => {
    // if (!info.menuItemId) {
    //   return;
    // }
    console.log('===>info: ', info);
    console.log('===>tab ??===>: ', tab);
  };

  @backgroundMethod()
  public async getContextMenuTitle(origin: string | null) {
    if (!origin) {
      return 'Prefer Not Using OneKey on This dApp';
    }
    const isDefaultWallet =
      await this.backgroundApi.serviceDApp.getIsDefaultWalletByOrigin(origin);
    return isDefaultWallet
      ? 'Prefer Not Using OneKey on This dApp'
      : 'Set OneKey as Default Wallet';
  }
}

export default ServiceContextMenu;
