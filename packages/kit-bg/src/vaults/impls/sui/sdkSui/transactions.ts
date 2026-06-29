import { Transaction, coinWithBalance } from '@mysten/sui/transactions';
import { SUI_TYPE_ARG, normalizeSuiAddress } from '@mysten/sui/utils';
import BigNumber from 'bignumber.js';

import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { OneKeySuiClient } from './ClientSui';
import type { BalanceChange } from '@mysten/sui/jsonRpc';

export enum ESuiTransactionType {
  ContractInteraction = 'ContractInteraction',
  TokenTransfer = 'Token Transfer',
  Unknown = 'UNKNOWN',
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
  maxSendNativeToken?: boolean;
}) {
  const tx = new Transaction();
  tx.setSender(sender);

  // totalBalance includes both coin objects and address balances
  const { totalBalance } = await client.getBalance({
    owner: sender,
    coinType,
  });

  if (new BigNumber(totalBalance).lt(amount)) {
    throw new OneKeyInternalError({
      key: ETranslations.earn_insufficient_balance,
    });
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

// coinWithBalance injects 0x2::coin / 0x2::balance helper calls (redeem_funds,
// send_funds, etc.) for address-balance transfers; not contract interactions.
function isCoinFrameworkMoveCall(moveCall: {
  package: string;
  module: string;
  function: string;
}) {
  return (
    normalizeSuiAddress(moveCall.package) === normalizeSuiAddress('0x2') &&
    (moveCall.module === 'coin' || moveCall.module === 'balance')
  );
}

function analyzeTransactionType(tx: Transaction) {
  const commands = tx.getData().commands;
  const hasMoveCall = commands.some(
    (cmd) =>
      cmd.$kind === 'MoveCall' &&
      cmd.MoveCall &&
      !isCoinFrameworkMoveCall(cmd.MoveCall),
  );
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

export default {
  createTokenTransaction,
  analyzeTransactionType,
  parseTransferDetails,
  parseMoveCall,
};
