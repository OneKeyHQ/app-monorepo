import { Transaction } from '@mysten/sui/transactions';
import { SUI_TYPE_ARG } from '@mysten/sui/utils';
import BigNumber from 'bignumber.js';

import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { normalizeSuiCoinType } from './utils';

import type { OneKeySuiClient } from './ClientSui';
import type { BalanceChange, CoinStruct } from '@mysten/sui/client';

export enum ESuiTransactionType {
  ContractInteraction = 'ContractInteraction',
  TokenTransfer = 'Token Transfer',
  Unknown = 'UNKNOWN',
}

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
  maxSendNativeToken = false,
}: {
  client: OneKeySuiClient;
  sender: string;
  recipient: string;
  amount: string;
  coinType: string;
  maxSendNativeToken?: boolean;
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

  // Max send native token
  if (maxSendNativeToken && coinType === SUI_TYPE_ARG) {
    tx.transferObjects([tx.gas], recipient);
    tx.setGasPayment(
      allCoins
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
  // Native token
  if (coinType === SUI_TYPE_ARG) {
    const coin = tx.splitCoins(tx.gas, [amount]);
    tx.transferObjects([coin], recipient);
  } else {
    // Token transfer
    const [primaryCoin, ...mergeCoins] = allCoins.filter(
      (coin) =>
        normalizeSuiCoinType(coin.coinType) === normalizeSuiCoinType(coinType),
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

function analyzeTransactionType(tx: Transaction) {
  const commands = tx.getData().commands;
  const hasMoveCall = commands.some((cmd) => cmd.$kind === 'MoveCall');
  if (hasMoveCall) {
    return ESuiTransactionType.ContractInteraction;
  }

  const transferCommands = commands.filter(
    (cmd) => cmd.$kind === 'TransferObjects',
  );
  if (transferCommands.length) {
    return ESuiTransactionType.TokenTransfer;
  }
  return ESuiTransactionType.Unknown;
}

interface ITransferDetail {
  from: string;
  to: string;
  amount: string;
  tokenAddress: string;
  gasFee?: string;
}
function parseTransferDetails({
  balanceChanges,
}: {
  balanceChanges: BalanceChange[];
}) {
  const transfers: ITransferDetail[] = [];

  const changesByCoinType = new Map<string, BalanceChange[]>();
  balanceChanges.forEach((change) => {
    const changes = changesByCoinType.get(change.coinType) || [];
    changes.push(change);
    changesByCoinType.set(change.coinType, changes);
  });

  // Process transfers for each token type
  for (const [tokenType, changes] of changesByCoinType.entries()) {
    const negativeChanges = changes.filter((c) =>
      new BigNumber(c.amount).isLessThan(0),
    );
    const positiveChanges = changes.filter((c) =>
      new BigNumber(c.amount).isGreaterThan(0),
    );

    // If there's only one negative record, it might be a self-transfer
    if (tokenType === SUI_TYPE_ARG) {
      // If there's only one negative record, it might be a self-transfer
      if (negativeChanges.length === 1 && positiveChanges.length === 0) {
        const change = negativeChanges[0];
        transfers.push({
          from: (change.owner as { AddressOwner: string }).AddressOwner,
          to: (change.owner as { AddressOwner: string }).AddressOwner,
          amount: new BigNumber(0).toString(), // Actual transfer amount is 0
          tokenAddress: tokenType,
          gasFee: new BigNumber(change.amount).abs().toString(), // Gas fee is the absolute value of the negative change
        });
      }
      // Regular transfer
      else if (positiveChanges.length > 0) {
        positiveChanges.forEach((posChange) => {
          const sender = negativeChanges.sort((a, b) =>
            new BigNumber(b.amount).minus(a.amount).toNumber(),
          )[0];

          if (sender) {
            const transferAmount = new BigNumber(posChange.amount);
            const negativeAmount = new BigNumber(sender.amount).abs();
            const gasFee = negativeAmount.minus(transferAmount);

            transfers.push({
              from: (sender.owner as { AddressOwner: string }).AddressOwner,
              to: (posChange.owner as { AddressOwner: string }).AddressOwner,
              amount: transferAmount.toString(),
              tokenAddress: tokenType,
              gasFee: gasFee.toString(),
            });
          }
        });
      }
    } else if (positiveChanges.length > 0) {
      // Transfers for other tokens
      positiveChanges.forEach((posChange) => {
        const sender = negativeChanges.sort((a, b) =>
          new BigNumber(b.amount).minus(a.amount).toNumber(),
        )[0];

        if (sender) {
          transfers.push({
            from: (sender.owner as { AddressOwner: string }).AddressOwner,
            to: (posChange.owner as { AddressOwner: string }).AddressOwner,
            amount: new BigNumber(posChange.amount).toString(),
            tokenAddress: tokenType,
          });
        }
      });
    }
  }

  return transfers;
}

function parseMoveCall(transaction: Transaction) {
  const tx = transaction.getData();
  if (!tx.commands || !tx.commands.length) {
    return null;
  }
  const firstMoveCallCommand = tx.commands.find((i) => i.$kind === 'MoveCall');

  if (!firstMoveCallCommand?.MoveCall) {
    return null;
  }

  const functionName = firstMoveCallCommand.MoveCall.function;
  const moduleName = firstMoveCallCommand.MoveCall.module;
  return {
    contractName: functionName,
    contractTo: `${moduleName}::${functionName}`,
  };
}

export default {
  createTokenTransaction,
  analyzeTransactionType,
  parseTransferDetails,
  parseMoveCall,
};
