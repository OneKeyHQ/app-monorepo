import { ParamsFormatter, ResultFormatter } from '@ckb-lumos/rpc';

import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';

import type { ECellStatus } from '../types';
import type { LiveCell, OutPoint } from '@ckb-lumos/base';
import type {
  GetCellsSearchKey,
  GetLiveCellsResult,
  Order,
} from '@ckb-lumos/ckb-indexer/src/type';
import type { RPC } from '@ckb-lumos/rpc/lib/types/rpc';

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

  async getCells<WithData extends boolean = true>(
    searchKey: GetCellsSearchKey<WithData>,
    order: Order,
    limit: string,
    cursor?: string,
  ): Promise<GetLiveCellsResult<WithData>> {
    const params = [
      ParamsFormatter.toGetCellsSearchKey(searchKey),
      order,
      limit,
      cursor,
    ];
    const [result] =
      await this.backgroundApi.serviceAccountProfile.sendProxyRequest<RPC.GetLiveCellsResult>(
        {
          networkId: this.networkId,
          body: [
            {
              route: 'rpc',
              params: {
                method: 'get_cells',
                params,
              },
            },
          ],
        },
      );

    return ResultFormatter.toGetCellsResult<WithData>(result);
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
              method: 'get_fee_rate_statistics',
              params: [],
            },
          },
        ],
      });

    return result;
  }

  async getLiveCell(outPoint: OutPoint, withData: boolean) {
    const params = [ParamsFormatter.toOutPoint(outPoint), withData];

    const [result] =
      await this.backgroundApi.serviceAccountProfile.sendProxyRequest<{
        cell: RPC.LiveCell;
        status: ECellStatus;
      }>({
        networkId: this.networkId,
        body: [
          {
            route: 'rpc',
            params: {
              method: 'get_live_cell',
              params,
            },
          },
        ],
      });
    return ResultFormatter.toLiveCellWithStatus(result);
  }
}

export default ClientCkb;
