import { SUI_TYPE_ARG, TransactionBlock } from '@mysten/sui.js';

import { normalizeSuiCoinType } from '../utils';

import type {
  CoinStruct,
  JsonRpcProvider,
  PaginatedCoins,
  SuiAddress,
} from '@mysten/sui.js';

const MAX_COINS_PER_REQUEST = 50;

export async function getAllCoins(
  client: JsonRpcProvider,
  address: SuiAddress,
  coinType: string | null,
): Promise<CoinStruct[]> {
  let cursor: string | null = null;
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
  client: JsonRpcProvider;
  address: SuiAddress;
  to: string;
  amount: string;
  coinType?: string;
  isPayAllSui?: boolean;
}) {
  const tx = new TransactionBlock();
  const coinsData = await getAllCoins(client, address, coinType);

  const coins = coinsData?.filter(({ lockedUntilEpoch: lock }) => !lock);

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
