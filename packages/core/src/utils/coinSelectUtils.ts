import coinSelectAuto from '@onekeyfe/coinselect';
import coinSelectAccumulative from '@onekeyfe/coinselect/accumulative';
import coinSelectBlackjack from '@onekeyfe/coinselect/blackjack';
import coinSelectBreak from '@onekeyfe/coinselect/break';
import coinSelectSplit from '@onekeyfe/coinselect/split';
import coinSelectUtils from '@onekeyfe/coinselect/utils';
import coinSelectWitness from '@onekeyfe/coinselect/witness';
import { isNil } from 'lodash';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { EAddressEncodings } from '../types';

import type {
  IInputsForCoinSelect,
  IOutputsForCoinSelect,
} from '../chains/btc/types';
import type {
  ICoinSelectInput,
  ICoinSelectOutput,
  ICoinSelectResult,
} from '@onekeyfe/coinselect';
import type {
  ICoinSelectResult as ICoinSelectResultWitness,
  IUtxo,
} from '@onekeyfe/coinselect/witness';
import type { Network } from 'bitcoinjs-lib';

export type ICoinSelectAlgorithm =
  | 'auto'
  | 'accumulative'
  | 'accumulative_desc'
  | 'blackjack'
  | 'break'
  | 'split';
export type ICoinSelectOptions = {
  inputsForCoinSelect: IInputsForCoinSelect;
  outputsForCoinSelect: IOutputsForCoinSelect;
  feeRate: string;
  algorithm?: ICoinSelectAlgorithm;
};

export type ICoinSelectWithWitnessOptions = {
  inputsForCoinSelect: IInputsForCoinSelect;
  outputsForCoinSelect: IOutputsForCoinSelect;
  feeRate: string;
  network: Network;
  changeAddress: {
    address: string;
    path: string;
  };
  txType: ICoinSelectPaymentType;
};

function utxoScore(x: ICoinSelectInput, feeRate: number) {
  return x.value - feeRate * coinSelectUtils.inputBytes(x);
}

function sortUtxo({
  utxos,
  feeRate,
}: {
  utxos: ICoinSelectInput[];
  feeRate: number;
}) {
  return utxos.concat().sort((a, b) => {
    if (a.forceSelect) {
      return -1;
    }
    if (b.forceSelect) {
      return 1;
    }
    return utxoScore(b, feeRate) - utxoScore(a, feeRate);
  });
}

export function coinSelectAccumulativeDesc(
  utxos: ICoinSelectInput[],
  outputs: ICoinSelectOutput[],
  feeRate: number,
): ICoinSelectResult {
  // eslint-disable-next-line no-param-reassign
  utxos = sortUtxo({
    utxos,
    feeRate,
  });

  return coinSelectAccumulative(utxos, outputs, feeRate) as ICoinSelectResult;
}

export const coinSelect = ({
  inputsForCoinSelect,
  outputsForCoinSelect,
  feeRate,
  algorithm = 'auto',
}: ICoinSelectOptions): ICoinSelectResult => {
  const max = outputsForCoinSelect.some((o) => o.type === 'send-max');

  // valid amount
  const validAmount = outputsForCoinSelect.every((o) => {
    if (o.type === 'send-max') {
      return typeof o.value === 'undefined';
    }
    return typeof o.value === 'number' && !Number.isNaN(o.value);
  });
  if (!validAmount) {
    throw new Error(
      'coinSelect ERROR: Invalid amount in outputs, you should specify valid value or isMax',
    );
  }

  const finalOutputs = outputsForCoinSelect.map((o) => ({
    address: o.address,
    value: o.type === 'send-max' ? undefined : o.value,
    script: o.script,
  }));

  let unspentSelectFn = max ? coinSelectSplit : coinSelectAuto;
  if (algorithm === 'accumulative_desc') {
    unspentSelectFn = coinSelectAccumulativeDesc;
  }
  if (algorithm === 'accumulative') {
    unspentSelectFn = coinSelectAccumulative;
  }
  if (algorithm === 'blackjack') {
    unspentSelectFn = coinSelectBlackjack;
  }
  if (algorithm === 'break') {
    unspentSelectFn = coinSelectBreak;
  }
  if (algorithm === 'split') {
    unspentSelectFn = coinSelectSplit;
  }
  const { inputs, outputs, fee }: ICoinSelectResult = unspentSelectFn(
    inputsForCoinSelect,
    finalOutputs,
    parseInt(feeRate, 10),
  );

  if (isNil(fee)) {
    throw new Error('coinSelect ERROR: No fee found');
  }
  return { inputs, outputs, fee };
};

export type ICoinSelectPaymentType =
  | 'p2pkh'
  | 'p2sh'
  | 'p2tr'
  | 'p2wpkh'
  | 'p2wsh';

export const getCoinSelectTxType = (
  encoding: EAddressEncodings,
): ICoinSelectPaymentType => {
  switch (encoding) {
    case EAddressEncodings.P2PKH:
      return 'p2pkh';
    case EAddressEncodings.P2SH_P2WPKH:
      return 'p2sh';
    case EAddressEncodings.P2WPKH:
      return 'p2wpkh';
    case EAddressEncodings.P2TR:
      return 'p2tr';
    case EAddressEncodings.P2WSH:
      return 'p2wsh';
    default:
      throw new Error('coinSelect ERROR: Invalid encoding');
  }
};

export interface ICoinSelectFailedResult {
  inputs: undefined;
  outputs: undefined;
  fee: undefined;
  bytes: undefined;
}

export function coinSelectWithWitness(
  params: ICoinSelectWithWitnessOptions,
): ICoinSelectResultWitness | ICoinSelectFailedResult {
  const {
    inputsForCoinSelect,
    outputsForCoinSelect,
    feeRate,
    network,
    changeAddress,
    txType,
  } = params;
  const coinselectParams = {
    utxos: inputsForCoinSelect.map((u) => ({
      ...u,
      own: true,
      coinbase: false,
      txid: u.txId,
    })) as IUtxo[],
    outputs: outputsForCoinSelect,
    feeRate,
    network,
    changeAddress,
    txType,
  };
  try {
    return coinSelectWitness(coinselectParams);
  } catch (error) {
    defaultLogger.transaction.coinSelect.coinSelectFailed(
      coinselectParams,
      error as Error,
    );
    return {
      inputs: undefined,
      outputs: undefined,
      fee: undefined,
      bytes: undefined,
    };
  }
}
