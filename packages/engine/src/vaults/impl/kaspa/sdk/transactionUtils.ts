import BigNumber from 'bignumber.js';

import type { Token } from '../../../../types/token';
import type { GetTransactionInput, GetTransactionOutput } from './types';

function convertInputUtxos(
  utxos: GetTransactionInput[],
  mineAddress: string,
  tokenInfo: Token,
) {
  return utxos?.map((utxo) => ({
    address: utxo.previous_outpoint_address,
    balance: new BigNumber(utxo.previous_outpoint_amount?.toString())
      .shiftedBy(-tokenInfo.decimals)
      .toFixed(),
    balanceValue: utxo.previous_outpoint_amount?.toString(),
    symbol: tokenInfo.symbol,
    isMine: utxo.previous_outpoint_address === mineAddress,
  }));
}

function convertOutputUtxos(
  utxos: GetTransactionOutput[],
  mineAddress: string,
  tokenInfo: Token,
) {
  return utxos?.map((utxo) => ({
    address: utxo.script_public_key_address,
    balance: new BigNumber(utxo.amount?.toString())
      .shiftedBy(-tokenInfo.decimals)
      .toFixed(),
    balanceValue: utxo.amount?.toString(),
    symbol: tokenInfo.symbol,
    isMine: utxo.script_public_key_address === mineAddress,
  }));
}

function determineFromAddress(
  mineAddress: string,
  hasSenderIncludeMine: boolean,
  hasReceiverIncludeMine: boolean,
  inputs: GetTransactionInput[],
) {
  if (!hasSenderIncludeMine && hasReceiverIncludeMine) {
    return (
      inputs?.find((input) => input.previous_outpoint_address !== mineAddress)
        ?.previous_outpoint_address || 'kaspa:00000000'
    );
  }
  return mineAddress;
}

function determineToAddresses(
  mineAddress: string,
  hasSenderIncludeMine: boolean,
  hasReceiverIncludeMine: boolean,
  outputs: GetTransactionOutput[],
  inputs: GetTransactionInput[],
) {
  const toAddresses = new Set<string>();
  const inputAddresses = new Set(
    inputs?.map((input) => input.previous_outpoint_address),
  );

  outputs?.forEach((output) => {
    if (hasSenderIncludeMine) {
      if (!inputAddresses.has(output.script_public_key_address)) {
        toAddresses.add(output.script_public_key_address);
      }
    } else if (output.script_public_key_address === mineAddress) {
      toAddresses.add(output.script_public_key_address);
    }
  });

  // 如果没有找到接收方地址，且我是发送方，添加我的地址
  if (hasSenderIncludeMine && toAddresses.size === 0 && outputs.length !== 0) {
    toAddresses.add(mineAddress);
  }

  return Array.from(toAddresses);
}

function calculateTxFee({
  inputs,
  outputs,
  mass,
  decimals,
}: {
  inputs: GetTransactionInput[] | undefined;
  outputs: GetTransactionOutput[] | undefined;
  mass: string | undefined;
  decimals: number;
}) {
  let nativeFee = '';
  try {
    const inputAmount =
      inputs?.reduce(
        (acc, input) => acc.plus(input.previous_outpoint_amount.toString()),
        new BigNumber(0),
      ) ?? new BigNumber(0);

    const outputAmount =
      outputs?.reduce(
        (acc, output) => acc.plus(output.amount.toString()),
        new BigNumber(0),
      ) ?? new BigNumber(0);

    if (inputAmount.isLessThanOrEqualTo(0)) {
      nativeFee = '0';
    } else {
      nativeFee = inputAmount
        .minus(outputAmount)
        .shiftedBy(-decimals)
        .toFixed();
    }
  } catch {
    nativeFee = new BigNumber(mass ?? '1').shiftedBy(-decimals).toFixed();
  }

  return nativeFee;
}

export {
  convertInputUtxos,
  convertOutputUtxos,
  determineFromAddress,
  determineToAddresses,
  calculateTxFee,
};
