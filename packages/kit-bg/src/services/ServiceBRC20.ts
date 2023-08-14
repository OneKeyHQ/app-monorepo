import BigNumber from 'bignumber.js';
import { isNil } from 'lodash';

import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import { getFiatEndpoint } from '@onekeyhq/engine/src/endpoint';
import type { NFTBTCAssetModel } from '@onekeyhq/engine/src/types/nft';
import {
  getTaprootXpub,
  isTaprootXpubSegwit,
} from '@onekeyhq/engine/src/vaults/utils/btcForkChain/utils';
import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';
import type {
  BRC20TokenAmountItem,
  BRC20TokenAmountListResponse,
} from '@onekeyhq/kit/src/views/Send/types';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { RestfulRequest } from '@onekeyhq/shared/src/request/RestfulRequest';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import ServiceBase from './ServiceBase';

@backgroundClass()
export default class ServiceBRC20 extends ServiceBase {
  @backgroundMethod()
  async getBRC20RecycleBalance(params: {
    networkId: string;
    xpub: string;
    address: string;
    tokenAddress: string;
    transferBalanceList?: BRC20TokenAmountItem[];
  }): Promise<string> {
    const { networkId, xpub, address, tokenAddress } = params;

    const recycleUtxos = (
      await simpleDb.utxoAccounts.getCoinControlList(
        networkId,
        isTaprootXpubSegwit(xpub) ? getTaprootXpub(xpub) : xpub,
      )
    ).filter((utxo) => utxo.recycle);

    let { transferBalanceList } = params;

    if (isNil(transferBalanceList)) {
      const resp = await this.getBRC20AmountList({
        networkId,
        address,
        tokenAddress,
        xpub,
      });
      transferBalanceList = resp.transferBalanceList ?? [];
    }

    const recycleAmountList = transferBalanceList.filter((item) =>
      recycleUtxos.find((utxo) => {
        const [txid, output] = utxo.key.split('_');
        const amountId = item.inscriptionId.slice(0, -2);
        const amountOutout = item.inscriptionId.slice(-1);
        return txid === amountId && output === amountOutout;
      }),
    );

    return recycleAmountList.reduce(
      (acc, cur) => new BigNumber(acc).plus(cur.amount).toFixed(),
      '0',
    );
  }

  @backgroundMethod()
  async getBRC20Inscriptions(params: {
    networkId: string;
    xpub: string;
    address: string;
    tokenAddress: string;
  }) {
    const { networkId, address, tokenAddress, xpub } = params;

    const req = new RestfulRequest(getFiatEndpoint(), {}, 60 * 1000);

    const query = {
      chain: networkId,
      address,
      tokenAddress,
    };

    try {
      const resp = (await req
        .get('/NFT/v2/list', query)
        .then((r) => r.json())) as { data: NFTBTCAssetModel[] };

      const archivedUtxos = await simpleDb.utxoAccounts.getCoinControlList(
        networkId ?? '',
        isTaprootXpubSegwit(xpub ?? '')
          ? getTaprootXpub(xpub ?? '')
          : xpub ?? '',
      );

      const recycleUtxos = archivedUtxos.filter((utxo) => utxo.recycle);

      return {
        inscriptions: resp.data,
        availableInscriptions: resp.data.filter((inscription) => {
          const [inscriptionTxId, inscriptionVout] =
            inscription.output.split(':');

          return !recycleUtxos.find((utxo) => {
            const [txId, vout] = utxo.key.split('_');
            return inscriptionTxId === txId && inscriptionVout === vout;
          });
        }),
      };
    } catch (e) {
      console.log('fetchBRC20Inscriptions error', e);
      return {
        inscriptions: [],
        availableInscriptions: [],
      };
    }
  }

  getBRC20AmountListCache = memoizee(
    async (params: {
      networkId: string;
      xpub: string;
      address: string;
      tokenAddress: string;
    }) => {
      const { networkId, address, tokenAddress, xpub } = params;
      const req = new RestfulRequest(getFiatEndpoint(), {}, 60 * 1000);

      const query = {
        network: networkId,
        address,
        tokenAddress,
        xpub,
      };

      try {
        const resp = (await req
          .get('/token/balances/brc20Detail', query)
          .then((r) => r.json())) as BRC20TokenAmountListResponse;
        return resp;
      } catch (e) {
        console.log('fetchBRC20AmountList error', e);
        return {
          balance: '0',
          availableBalance: '0',
          transferBalance: '0',
          transferBalanceList: [],
        };
      }
    },
    {
      primitive: true,
      promise: true,
      max: 100,
      maxAge: getTimeDurationMs({ seconds: 10 }),
    },
  );

  @backgroundMethod()
  async getBRC20AmountList(params: {
    networkId: string;
    xpub: string;
    address: string;
    tokenAddress: string;
  }) {
    const resp = await this.getBRC20AmountListCache(params);
    return resp;
  }
}
