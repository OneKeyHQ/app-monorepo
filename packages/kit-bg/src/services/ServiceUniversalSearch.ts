import { sortBy } from 'lodash';
import RNRestart from 'react-native-restart';

import {
  backgroundClass,
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { DB_MAIN_CONTEXT_ID } from '@onekeyhq/shared/src/consts/dbConsts';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import * as Errors from '@onekeyhq/shared/src/errors';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
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
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IIUniversalRecentSearchItem,
  IUniversalSearchAddress,
  IUniversalSearchBatchResult,
  IUniversalSearchResultItem,
  IUniversalSearchSingleResult,
} from '@onekeyhq/shared/types/search';
import { EUniversalSearchType } from '@onekeyhq/shared/types/search';

import localDb from '../dbs/local/localDb';
import { ELocalDBStoreNames } from '../dbs/local/localDBStoreNames';
import {
  settingsPersistAtom,
  universalSearchPersistAtom,
} from '../states/jotai/atoms';
import { vaultFactory } from '../vaults/factory';

import ServiceBase from './ServiceBase';

const MAX_RECENT_SEARCH_SIZE = 10;
@backgroundClass()
class ServiceUniversalSearch extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  async universalSearchRecommend({
    searchTypes,
  }: {
    searchTypes: EUniversalSearchType[];
  }): Promise<IUniversalSearchBatchResult> {
    const result: IUniversalSearchBatchResult = {};
    if (!searchTypes.length) {
      return [] as IUniversalSearchBatchResult;
    }
    if (searchTypes.includes(EUniversalSearchType.MarketToken)) {
      const items =
        await this.backgroundApi.serviceMarket.fetchSearchTrending();
      result[EUniversalSearchType.MarketToken] = {
        items: items.map((item) => ({
          type: EUniversalSearchType.MarketToken,
          payload: item,
        })),
      };
    }
    return result;
  }

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

    if (searchTypes.includes(EUniversalSearchType.MarketToken)) {
      const items = await this.universalSearchOfMarketToken(input);
      result[EUniversalSearchType.MarketToken] = {
        items: items.map((item) => ({
          type: EUniversalSearchType.MarketToken,
          payload: item,
        })),
      };
    }
    return result;
  }

  async universalSearchOfMarketToken(query: string) {
    return this.backgroundApi.serviceMarket.searchToken(query);
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
          } as IUniversalSearchResultItem);
        }
      } catch (error) {
        (error as IOneKeyError).$$autoPrintErrorIgnore = true;
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

    items = sortBy(
      items as IUniversalSearchAddress[],
      (item: IUniversalSearchAddress) => {
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
      },
    );

    return {
      items,
    } as IUniversalSearchSingleResult;
  }

  @backgroundMethod()
  async addIntoRecentSearch(item: IIUniversalRecentSearchItem, delay = 10) {
    setTimeout(async () => {
      await universalSearchPersistAtom.set((prev) => {
        const newItems = prev.recentSearch.filter(
          (recentSearchItem) =>
            !!prev.recentSearch.find((i) => i.text === recentSearchItem.text),
        );
        return {
          ...prev,
          recentSearch: [item, ...newItems].slice(0, MAX_RECENT_SEARCH_SIZE),
        };
      });
    }, delay);
  }

  @backgroundMethod()
  async clearAllRecentSearch() {
    await universalSearchPersistAtom.set((prev) => ({
      ...prev,
      recentSearch: [],
    }));
  }
}

export default ServiceUniversalSearch;
