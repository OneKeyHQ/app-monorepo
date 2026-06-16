import { Transaction, coinWithBalance } from '@mysten/sui/transactions';
import { SUI_TYPE_ARG, normalizeSuiAddress } from '@mysten/sui/utils';
import BigNumber from 'bignumber.js';

import {
  OneKeyInternalError,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { normalizeSuiCoinType } from './utils';

import type { OneKeySuiClient } from './ClientSui';
import type { BalanceChange, CoinStruct } from '@mysten/sui/jsonRpc';
import type { TransactionObjectArgument } from '@mysten/sui/transactions';

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
        throw new OneKeyLocalError(
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
  tx.setSender(sender);

  // totalBalance includes both coin objects and address balances
  const { totalBalance, fundsInAddressBalance } = await client.getBalance({
    owner: sender,
    coinType,
  });

  if (new BigNumber(totalBalance).lt(amount)) {
    throw new OneKeyInternalError({
      key: ETranslations.earn_insufficient_balance,
    });
  }

  // Max send native token
  if (maxSendNativeToken && coinType === SUI_TYPE_ARG) {
    const allCoins = await getAllCoinsByCoinType({
      client,
      address: sender,
      coinType,
    });

    // No coin objects: pay gas from the address balance (gasMode addressBalance).
    // We must NOT reference tx.gas here — using it forces the SDK to require a
    // gas coin (usesGasCoin=true). With no tx.gas, the resolver leaves the gas
    // payment empty and withdraws gas from the address balance automatically.
    if (allCoins.length === 0) {
      const addressBalanceOnly = new BigNumber(fundsInAddressBalance ?? '0');
      if (addressBalanceOnly.lte(0)) {
        throw new OneKeyInternalError({
          key: ETranslations.earn_insufficient_balance,
        });
      }
      // `amount` is the max-send amount (already balance - fee). Withdraw it and
      // send it out; the gas budget is withdrawn from the remaining balance.
      const [withdrawn] = tx.moveCall({
        target: '0x2::coin::redeem_funds',
        typeArguments: [coinType],
        arguments: [
          tx.withdrawal({
            amount: new BigNumber(amount).toFixed(0),
            type: coinType,
          }),
        ],
      });
      tx.transferObjects([withdrawn], recipient);
      return tx;
    }

    const transferred: TransactionObjectArgument[] = [tx.gas];
    const addressBalance = new BigNumber(fundsInAddressBalance ?? '0');
    if (addressBalance.gt(0)) {
      const [withdrawn] = tx.moveCall({
        target: '0x2::coin::redeem_funds',
        typeArguments: [coinType],
        arguments: [
          tx.withdrawal({ amount: addressBalance.toFixed(), type: coinType }),
        ],
      });
      transferred.push(withdrawn);
    }
    tx.transferObjects(transferred, recipient);
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

  // coinWithBalance resolves from coin objects and address balances at build time
  const coin = tx.add(
    coinWithBalance({
      type: coinType,
      balance: BigInt(amount),
    }),
  );
  tx.transferObjects([coin], recipient);
  return tx;
}

// 0x2::{coin,balance}::send_funds (deposit) and redeem_funds (withdraw) operate
// on address balances and are part of plain transfers, not contract interactions.
function isAddressBalanceCall(moveCall: {
  package: string;
  module: string;
  function: string;
}) {
  return (
    normalizeSuiAddress(moveCall.package) === normalizeSuiAddress('0x2') &&
    (moveCall.module === 'coin' || moveCall.module === 'balance') &&
    (moveCall.function === 'redeem_funds' || moveCall.function === 'send_funds')
  );
}

function analyzeTransactionType(tx: Transaction) {
  const commands = tx.getData().commands;
  const moveCalls = commands.filter(
    (cmd) => cmd.$kind === 'MoveCall' && cmd.MoveCall,
  );

  // Any move call that is NOT an address-balance op makes this a contract call.
  const hasContractMoveCall = moveCalls.some(
    (cmd) => cmd.MoveCall && !isAddressBalanceCall(cmd.MoveCall),
  );
  if (hasContractMoveCall) {
    return ESuiTransactionType.ContractInteraction;
  }

  // send_funds deposits have no TransferObjects command, so treat any
  // address-balance op as a transfer too (not just TransferObjects).
  const hasAddressBalanceCall = moveCalls.some(
    (cmd) => cmd.MoveCall && isAddressBalanceCall(cmd.MoveCall),
  );
  const hasTransferCommand = commands.some(
    (cmd) => cmd.$kind === 'TransferObjects',
  );
  if (hasAddressBalanceCall || hasTransferCommand) {
    return ESuiTransactionType.TokenTransfer;
  }
  return ESuiTransactionType.Unknown;
}

export interface ITransferDetail {
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
          amount: new BigNumber(0).toFixed(), // Actual transfer amount is 0
          tokenAddress: tokenType,
          gasFee: new BigNumber(change.amount).abs().toFixed(), // Gas fee is the absolute value of the negative change
        });
      }
      // Regular transfer
      else if (positiveChanges.length > 0) {
        positiveChanges.forEach((posChange) => {
          const sender = negativeChanges.toSorted((a, b) =>
            new BigNumber(b.amount).minus(a.amount).toNumber(),
          )[0];

          if (sender) {
            const transferAmount = new BigNumber(posChange.amount);
            const negativeAmount = new BigNumber(sender.amount).abs();
            const gasFee = negativeAmount.minus(transferAmount);

            transfers.push({
              from: (sender.owner as { AddressOwner: string }).AddressOwner,
              to: (posChange.owner as { AddressOwner: string }).AddressOwner,
              amount: transferAmount.toFixed(),
              tokenAddress: tokenType,
              gasFee: gasFee.toFixed(),
            });
          }
        });
      }
    } else if (positiveChanges.length > 0) {
      // Transfers for other tokens
      positiveChanges.forEach((posChange) => {
        const sender = negativeChanges.toSorted((a, b) =>
          new BigNumber(b.amount).minus(a.amount).toNumber(),
        )[0];

        if (sender) {
          transfers.push({
            from: (sender.owner as { AddressOwner: string }).AddressOwner,
            to: (posChange.owner as { AddressOwner: string }).AddressOwner,
            amount: new BigNumber(posChange.amount).toFixed(),
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

// Deposit a coin into the recipient's address balance accumulator.
// 0x2::coin::send_funds<T>(coin: Coin<T>, recipient: address) — anyone can deposit.
function createSendToAddressBalanceTransaction({
  sender,
  recipient,
  amount,
  coinType,
}: {
  sender: string;
  recipient: string;
  amount: string; // base units (MIST)
  coinType: string;
}) {
  const tx = new Transaction();
  tx.setSender(sender);
  tx.moveCall({
    target: '0x2::coin::send_funds',
    typeArguments: [coinType],
    arguments: [
      // coinWithBalance sources from owned coins / address balance at build time
      tx.coin({ type: coinType, balance: BigInt(amount) }),
      tx.pure.address(recipient),
    ],
  });
  return tx;
}

// Withdraw from the sender's own address balance and send it out as a coin.
// 0x2::coin::redeem_funds<T>(Withdrawal<Balance<T>>) -> Coin<T>, then transfer.
function createWithdrawFromAddressBalanceTransaction({
  sender,
  recipient,
  amount,
  coinType,
}: {
  sender: string;
  recipient: string;
  amount: string; // base units (MIST)
  coinType: string;
}) {
  const tx = new Transaction();
  tx.setSender(sender);
  const [withdrawn] = tx.moveCall({
    target: '0x2::coin::redeem_funds',
    typeArguments: [coinType],
    arguments: [
      tx.withdrawal({ amount: BigInt(amount).toString(), type: coinType }),
    ],
  });
  tx.transferObjects([withdrawn], recipient);
  return tx;
}

export default {
  createTokenTransaction,
  createSendToAddressBalanceTransaction,
  createWithdrawFromAddressBalanceTransaction,
  analyzeTransactionType,
  parseTransferDetails,
  parseMoveCall,
};
