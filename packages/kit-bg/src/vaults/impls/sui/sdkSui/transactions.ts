import { Transaction } from '@mysten/sui/transactions';
import { SUI_TYPE_ARG } from '@mysten/sui.js';
import BigNumber from 'bignumber.js';

import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import type { OneKeySuiClient } from './ClientSui';
import type { CoinStruct } from '@mysten/sui/client';

async function getAllCoinsByCoinType({
  client,
  address,
  coinType,
}: {
  client: OneKeySuiClient;
  address: string;
  coinType: string;
}) {
  let cursor: string | null | undefined = null;
  const allCoins: CoinStruct[] = [];
  let hasNextPage = true;
  const maxRetries = 5;
  let retries = 0;

  while (hasNextPage && retries < maxRetries) {
    try {
      const resp = await client.getCoins({
        owner: address,
        coinType,
        cursor,
        limit: 50,
      });

      const { data, nextCursor, hasNextPage: nextPageExists } = resp;

      if (data && data.length) {
        allCoins.push(...data);
      }

      cursor = nextCursor;
      hasNextPage = nextPageExists;
      retries = 0; // Reset retry count on successful request
    } catch (error) {
      retries += 1;
      console.error(`Failed to fetch coins, retry attempt: ${retries}`, error);
      if (retries >= maxRetries) {
        throw new Error(
          'Failed to fetch coins, maximum retry attempts reached',
        );
      }
      // Add delay before retrying
      await timerUtils.wait(300);
    }
  }

  return allCoins;
}

async function createTokenTransaction({
  client,
  sender,
  recipient,
  amount,
  coinType,
}: {
  client: OneKeySuiClient;
  sender: string;
  recipient: string;
  amount: string;
  coinType: string;
}) {
  const tx = new Transaction();
  const allCoins = await getAllCoinsByCoinType({
    client,
    address: sender,
    coinType,
  });

  const totalBalance = allCoins.reduce(
    (sum, coin) => sum.plus(coin.balance),
    new BigNumber(0),
  );

  if (totalBalance.lt(amount)) {
    throw new Error('Insufficient balance');
  }

  // Native token
  if (coinType === SUI_TYPE_ARG) {
    const coin = tx.splitCoins(tx.gas, [amount]);
    tx.transferObjects([coin], recipient);
  } else {
    // Token transfer
    const [primaryCoin, ...mergeCoins] = allCoins.filter(
      (coin) => coin.coinType === coinType,
    );
    const primaryCoinInput = tx.object(primaryCoin.coinObjectId);
    if (mergeCoins.length) {
      tx.mergeCoins(
        primaryCoinInput,
        mergeCoins.map((coin) => tx.object(coin.coinObjectId)),
      );
    }
    const coin = tx.splitCoins(primaryCoinInput, [amount]);
    tx.transferObjects([coin], recipient);
  }
  return tx;
}

export default {
  createTokenTransaction,
};
