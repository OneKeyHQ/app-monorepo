import { sortBy } from 'lodash';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IUniversalSearchAddress,
  IUniversalSearchBatchResult,
  IUniversalSearchResultItem,
  IUniversalSearchSingleResult,
} from '@onekeyhq/shared/types/search';
import { EUniversalSearchType } from '@onekeyhq/shared/types/search';

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

  private getUniversalValidateNetworkIds = memoizee(
    async () => {
      const { serviceNetwork } = this.backgroundApi;
      const { networks } = await serviceNetwork.getAllNetworks();
      let isEvmAddressChecked = false;
      const items: string[] = [];
      for (const network of networks) {
        if (
          [
            //
            getNetworkIdsMap().lightning,
            getNetworkIdsMap().tlightning,
            //
          ].includes(network.id)
        ) {
          // eslint-disable-next-line no-continue
          continue;
        }

        if (isEvmAddressChecked && network.impl === IMPL_EVM) {
          // eslint-disable-next-line no-continue
          continue;
        }
        items.push(network.id);

        // evm address check only once
        if (network.impl === IMPL_EVM) {
          isEvmAddressChecked = true;
        }
      }
      return items;
    },
    {
      maxAge: timerUtils.getTimeDurationMs({ hour: 1 }),
    },
  );

  async universalSearchOfAddress({
    input,
    networkId,
  }: {
    input: string;
    networkId?: string;
  }): Promise<IUniversalSearchSingleResult> {
    let items: IUniversalSearchResultItem[] = [];
    const { serviceNetwork, serviceValidator } = this.backgroundApi;
    const networkIdList = await this.getUniversalValidateNetworkIds();
    const batchValidateResult =
      await serviceValidator.serverBatchValidateAddress({
        networkIdList,
        accountAddress: input,
      });

    // failed to validate address on server side
    if (!batchValidateResult.isValid) {
      return { items } as IUniversalSearchSingleResult;
    }

    for (const batchNetworkId of batchValidateResult.networkIds) {
      const network = await serviceNetwork.getNetworkSafe({
        networkId: batchNetworkId,
      });
      const localValidateResult = await serviceValidator.localValidateAddress({
        networkId: batchNetworkId,
        address: input,
      });
      if (network && localValidateResult.isValid) {
        items.push({
          type: EUniversalSearchType.Address,
          payload: {
            addressInfo: localValidateResult,
            network,
          },
        } as IUniversalSearchResultItem);
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
