import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';

import type { ECellStatus } from '../types';
import type { LiveCell, OutPoint } from '@ckb-lumos/base';
import type {
  GetCellsResults,
  SearchKey,
  SearchKeyFilter,
  Terminator,
} from '@ckb-lumos/ckb-indexer/src/type';

const DefaultTerminator: Terminator = () => ({ stop: false, push: true });

class ClientCkb {
  private backgroundApi: IBackgroundApi;

  private networkId: string;

  constructor({
    backgroundApi,
    networkId,
  }: {
    backgroundApi: any;
    networkId: string;
  }) {
    this.networkId = networkId;
    this.backgroundApi = backgroundApi;
  }

  async getCells(
    searchKey: SearchKey,
    terminator: Terminator = DefaultTerminator,
    searchKeyFilter: SearchKeyFilter = {},
  ) {
    const [result] =
      await this.backgroundApi.serviceAccountProfile.sendProxyRequest<GetCellsResults>(
        {
          networkId: this.networkId,
          body: [
            {
              route: 'indexer',
              params: {
                method: 'getCells',
                params: [searchKey, terminator, searchKeyFilter],
              },
            },
          ],
        },
      );

    return result;
  }

  async getFeeRateStatistics() {
    const [result] =
      await this.backgroundApi.serviceAccountProfile.sendProxyRequest<{
        mean: string;
        median: string;
      }>({
        networkId: this.networkId,
        body: [
          {
            route: 'rpc',
            params: {
              method: 'getFeeRateStatistics',
              params: [],
            },
          },
        ],
      });

    return result;
  }

  async getLiveCell(outPoint: OutPoint, withData: boolean) {
    const [result] =
      await this.backgroundApi.serviceAccountProfile.sendProxyRequest<{
        cell: LiveCell;
        status: ECellStatus;
      }>({
        networkId: this.networkId,
        body: [
          {
            route: 'rpc',
            params: {
              method: 'getLiveCell',
              params: [outPoint, withData],
            },
          },
        ],
      });

    return result;
  }
}

export default ClientCkb;
