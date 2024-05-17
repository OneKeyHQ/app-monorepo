import { TransactionBlock } from '@mysten/sui.js/transactions';
import { SUI_TYPE_ARG } from '@mysten/sui.js/utils';

import { normalizeSuiCoinType } from './utils';

import type {
  CoinStruct,
  PaginatedCoins,
  SuiClient,
} from '@mysten/sui.js/client';

const MAX_COINS_PER_REQUEST = 50;

export async function getAllCoins(
  client: SuiClient,
  address: string,
  coinType: string | null,
): Promise<CoinStruct[]> {
  let cursor: string | null | undefined = null;
  const allData: CoinStruct[] = [];
  do {
    const { data, nextCursor }: PaginatedCoins = await client.getCoins({
      owner: address,
      coinType,
      cursor,
      limit: MAX_COINS_PER_REQUEST,
    });
    if (!data || !data.length) {
      break;
    }

    for (const item of data) {
      const normalCoinType = normalizeSuiCoinType(item.coinType);
      allData.push({
        ...item,
        coinType: normalCoinType,
      });
    }

    cursor = nextCursor;
  } while (cursor);

  return allData;
}

export async function createCoinSendTransaction({
  client,
  address,
  to,
  amount,
  coinType = SUI_TYPE_ARG,
  isPayAllSui,
}: {
  client: SuiClient;
  address: string;
  to: string;
  amount: string;
  coinType?: string;
  isPayAllSui?: boolean;
}) {
  const tx = new TransactionBlock();
  const coinsData = await getAllCoins(client, address, coinType);

  // TODO: debugger struct
  // const coins = coinsData?.filter(({ lockedUntilEpoch: lock }) => !lock);
  const coins = coinsData;

  if (isPayAllSui && coinType === SUI_TYPE_ARG) {
    tx.transferObjects([tx.gas], tx.pure(to));
    tx.setGasPayment(
      coins
        .filter(
          (coin) =>
            normalizeSuiCoinType(coin.coinType) ===
            normalizeSuiCoinType(coinType),
        )
        .map((coin) => ({
          objectId: coin.coinObjectId,
          digest: coin.digest,
          version: coin.version,
        })),
    );

    return tx;
  }

  const [primaryCoin, ...mergeCoins] = coins.filter(
    (coin) =>
      normalizeSuiCoinType(coin.coinType) === normalizeSuiCoinType(coinType),
  );

  if (coinType === SUI_TYPE_ARG) {
    const coin = tx.splitCoins(tx.gas, [tx.pure(amount)]);
    tx.transferObjects([coin], tx.pure(to));
  } else {
    const primaryCoinInput = tx.object(primaryCoin.coinObjectId);
    if (mergeCoins.length) {
      tx.mergeCoins(
        primaryCoinInput,
        mergeCoins.map((coin) => tx.object(coin.coinObjectId)),
      );
    }
    const coin = tx.splitCoins(primaryCoinInput, [tx.pure(amount)]);
    tx.transferObjects([coin], tx.pure(to));
  }

  return tx;
}
