import { sortBy } from 'lodash';
import RNRestart from 'react-native-restart';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import type { IOpenUrlRouteInfo } from '@onekeyhq/shared/src/utils/extUtils';
import extUtils from '@onekeyhq/shared/src/utils/extUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type {
  IUniversalSearchBatchResult,
  IUniversalSearchResultItem,
  IUniversalSearchSingleResult,
} from '@onekeyhq/shared/types/search';
import { EUniversalSearchType } from '@onekeyhq/shared/types/search';

import localDb from '../dbs/local/localDb';
import { vaultFactory } from '../vaults/factory';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceApp extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  private restartApp() {
    if (platformEnv.isNative) {
      return RNRestart.restart();
    }
    if (platformEnv.isDesktop) {
      return window.desktopApi?.reload?.();
    }
    // restartApp() MUST be called from background in Ext, UI reload will close whole Browser
    if (platformEnv.isExtensionBackground) {
      return chrome.runtime.reload();
    }
    if (platformEnv.isRuntimeBrowser) {
      return window?.location?.reload?.();
    }
  }

  @backgroundMethod()
  async resetApp() {
    await localDb.reset();
    await appStorage.clear();
    this.restartApp();
  }

  @backgroundMethod()
  async showToast(params: IAppEventBusPayload[EAppEventBusNames.ShowToast]) {
    appEventBus.emit(EAppEventBusNames.ShowToast, params);
  }

  @backgroundMethod()
  async openExtensionExpandTab(routeInfo: IOpenUrlRouteInfo) {
    await extUtils.openExpandTab(routeInfo);
  }

  // TODO move to standalone service
  @backgroundMethod()
  async universalSearch({
    input,
    networkId,
    searchTypes,
  }: {
    input: string;
    networkId?: string;
    searchTypes: EUniversalSearchType[];
  }): Promise<IUniversalSearchBatchResult> {
    const result: IUniversalSearchBatchResult = {};
    if (searchTypes.includes(EUniversalSearchType.Address)) {
      const r = await this.universalSearchOfAddress({ input, networkId });
      result[EUniversalSearchType.Address] = r;
    }
    return result;
  }

  async universalSearchOfAddress({
    input,
    networkId,
  }: {
    input: string;
    networkId?: string;
  }): Promise<IUniversalSearchSingleResult> {
    let items: IUniversalSearchResultItem[] = [];
    const { networks } =
      await this.backgroundApi.serviceNetwork.getAllNetworks();
    let isEvmAddressChecked = false;
    for (const network of networks) {
      const vault = await vaultFactory.getChainOnlyVault({
        networkId: network.id,
      });

      if (isEvmAddressChecked && network.impl === IMPL_EVM) {
        // eslint-disable-next-line no-continue
        continue;
      }

      try {
        const r = await vault.validateAddress(input);
        if (r.isValid) {
          items.push({
            type: EUniversalSearchType.Address,
            payload: {
              addressInfo: r,
              network,
            },
          });
        }
      } catch (error) {
        errorUtils.autoPrintErrorIgnore(error);
      }

      // evm address check only once
      if (network.impl === IMPL_EVM) {
        isEvmAddressChecked = true;
      }
    }

    const currentNetwork =
      await this.backgroundApi.serviceNetwork.getNetworkSafe({
        networkId,
      });

    items = sortBy(items, (item) => {
      if (currentNetwork?.id) {
        const currentImpl = networkUtils.getNetworkImpl({
          networkId: currentNetwork.id,
        });
        // use home EVM network as result
        if (
          currentImpl === IMPL_EVM &&
          item.payload.network.impl === currentImpl
        ) {
          item.payload.network = currentNetwork;
          return 0;
        }
      }
      return 1;
    });

    return {
      items,
    };
  }
}

export default ServiceApp;
