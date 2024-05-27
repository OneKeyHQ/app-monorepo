import { sortBy } from 'lodash';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type {
  IUniversalSearchAddress,
  IUniversalSearchBatchResult,
  IUniversalSearchResultItem,
  IUniversalSearchSingleResult,
} from '@onekeyhq/shared/types/search';
import { EUniversalSearchType } from '@onekeyhq/shared/types/search';

import { vaultFactory } from '../vaults/factory';

import ServiceBase from './ServiceBase';

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
}

export default ServiceUniversalSearch;
