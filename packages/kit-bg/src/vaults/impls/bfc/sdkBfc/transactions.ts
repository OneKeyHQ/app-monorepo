/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { TransactionBlock } from '@benfen/bfc.js/transactions';
import { BFC_TYPE_ARG } from '@benfen/bfc.js/utils';
import BigNumber from 'bignumber.js';

import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { normalizeBfcCoinType, objectTypeToCoinType } from './utils';

import type { OneKeyBfcClient } from './ClientBfc';
import type { BalanceChange, CoinStruct } from '@benfen/bfc.js/client';

export enum EBfcTransactionType {
  ContractInteraction = 'ContractInteraction',
  TokenTransfer = 'Token Transfer',
  Unknown = 'UNKNOWN',
}

async function getAllCoinsByCoinType({
  client,
  address,
  coinType,
}: {
  client: OneKeyBfcClient;
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
  client: OneKeyBfcClient;
  sender: string;
  recipient: string;
  amount: string;
  coinType: string;
  maxSendNativeToken?: boolean;
}) {
  const tx = new TransactionBlock();
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
  if (maxSendNativeToken && coinType === BFC_TYPE_ARG) {
    tx.transferObjects([tx.gas], recipient);
    tx.setGasPayment(
      allCoins
        .filter(
          (coin) =>
            normalizeBfcCoinType(coin.coinType) ===
            normalizeBfcCoinType(coinType),
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
  if (coinType === BFC_TYPE_ARG) {
    const coin = tx.splitCoins(tx.gas, [amount]);
    tx.transferObjects([coin], recipient);
  } else {
    // Token transfer
    const [primaryCoin, ...otherCoins] = allCoins.filter(
      (coin) =>
        normalizeBfcCoinType(coin.coinType) === normalizeBfcCoinType(coinType),
    );
    let currentAmount = new BigNumber(primaryCoin.balance);
    const targetAmount = new BigNumber(amount);
    const coinsToMerge = [];

    // merge coin from other utxo coins.
    for (const coin of otherCoins) {
      if (currentAmount.isGreaterThanOrEqualTo(targetAmount)) {
        break;
      }
      coinsToMerge.push(coin);
      currentAmount = currentAmount.plus(new BigNumber(coin.balance));
    }

    const primaryCoinInput = tx.object(primaryCoin.coinObjectId);
    if (coinsToMerge.length > 0) {
      tx.mergeCoins(
        primaryCoinInput,
        coinsToMerge.map((coin) => tx.object(coin.coinObjectId)),
      );
    }
    const coin = tx.splitCoins(primaryCoinInput, [amount]);
    tx.transferObjects([coin], recipient);
  }
  return tx;
}

function analyzeTransactionType(tx: TransactionBlock) {
  const transactions = tx.blockData.transactions;
  const hasMoveCall = transactions.some((i) => i.kind === 'MoveCall');
  if (hasMoveCall) {
    return EBfcTransactionType.ContractInteraction;
  }

  const transferCommands = transactions.filter(
    (cmd) => cmd.kind === 'TransferObjects',
  );
  if (transferCommands.length) {
    return EBfcTransactionType.TokenTransfer;
  }
  return EBfcTransactionType.Unknown;
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
    if (tokenType === BFC_TYPE_ARG) {
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

function parseMoveCall(transaction: TransactionBlock) {
  if (!transaction.blockData.transactions?.length) {
    return null;
  }
  const transactions = transaction.blockData.transactions;
  const firstMoveCallCommand = transactions.find((i) => i.kind === 'MoveCall');

  if (!firstMoveCallCommand) {
    return null;
  }

  // @ts-ignore
  const target = firstMoveCallCommand.target;
  if (!target) {
    return null;
  }

  const parts = target.split('::');
  if (parts.length !== 3) {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_, moduleName, functionName] = parts;

  return {
    contractName: functionName,
    contractTo: `${moduleName}::${functionName}`,
  };
}

async function getCoinTypeForHardwareTransfer({
  client,
  txBytes,
}: {
  client: OneKeyBfcClient;
  txBytes: Uint8Array;
}): Promise<string | null> {
  const tx = TransactionBlock.from(txBytes);
  const transactions = tx.blockData.transactions;

  const hasMoveCall = transactions.some((cmd) => cmd.kind === 'MoveCall');
  if (hasMoveCall) {
    return null;
  }

  const transferCommands = transactions.filter(
    (cmd) => cmd.kind === 'TransferObjects',
  );

  if (transferCommands.length !== 1) {
    return null;
  }

  const transferCommand = transferCommands[0];

  // @ts-ignore
  const resultObj = transferCommand?.objects?.[0];
  if (resultObj.kind === 'GasCoin') {
    return BFC_TYPE_ARG;
  }

  if (resultObj?.kind !== 'Result' || typeof resultObj.index !== 'number') {
    return null;
  }

  // find the command that generates this Result
  const sourceCommand = transactions[resultObj.index];
  if (sourceCommand?.kind === 'SplitCoins') {
    if (sourceCommand.coin?.kind === 'GasCoin') {
      return BFC_TYPE_ARG;
    }

    if (sourceCommand.coin?.kind === 'Input') {
      const inputIndex = sourceCommand.coin.index;
      const input = tx.blockData.inputs[inputIndex];

      const objectId = input?.value?.Object?.ImmOrOwned?.objectId;
      if (objectId) {
        const objectInfo = await client.getObject({
          id: objectId,
          options: {
            showType: true,
            showOwner: true,
            showPreviousTransaction: true,
            showDisplay: false,
          },
        });
        try {
          const objectType = objectInfo.data?.type;
          if (!objectType) {
            return null;
          }
          return objectTypeToCoinType(objectType);
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

export default {
  createTokenTransaction,
  analyzeTransactionType,
  parseTransferDetails,
  parseMoveCall,
  getCoinTypeForHardwareTransfer,
};
