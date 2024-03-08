import coinSelectAuto from 'coinselect';
import coinSelectAccumulative from 'coinselect/accumulative';
import coinSelectBlackjack from 'coinselect/blackjack';
import coinSelectBreak from 'coinselect/break';
import coinSelectSplit from 'coinselect/split';
import coinSelectUtils from 'coinselect/utils';
import { isNil } from 'lodash';

import type {
  IInputsForCoinSelect,
  IOutputsForCoinSelect,
} from '../chains/btc/types';
import type {
  ICoinSelectInput,
  ICoinSelectOutput,
  ICoinSelectResult,
} from 'coinselect';

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

function utxoScore(x: ICoinSelectInput, feeRate: number) {
  return x.value - feeRate * coinSelectUtils.inputBytes(x);
}

// TODO move to standalone npm package, and adding full fixture tests
export function blackjackPro(
  utxos: ICoinSelectInput[],
  outputs: ICoinSelectOutput[],
  feeRateNum: number,
): ICoinSelectResult {
  if (!Number.isFinite(coinSelectUtils.uintOrNaN(feeRateNum))) return {};

  let bytesAccum = coinSelectUtils.transactionBytes([], outputs);

  let inAccum = 0;
  const inputs = [];
  const outAccum = coinSelectUtils.sumOrNaN(outputs);
  const threshold = coinSelectUtils.dustThreshold({}, feeRateNum);

  for (let i = 0; i < utxos.length; i += 1) {
    const input = utxos[i];
    const inputBytes = coinSelectUtils.inputBytes(input);
    const fee = feeRateNum * (bytesAccum + inputBytes);
    const inputValue = coinSelectUtils.uintOrNaN(input.value);

    if (!input.forceSelect) {
      // would it waste value?
      if (inAccum + inputValue > outAccum + fee + threshold)
        // eslint-disable-next-line no-continue
        continue;
    }

    bytesAccum += inputBytes;
    inAccum += inputValue;
    inputs.push(input);

    // go again?
    if (inAccum < outAccum + fee)
      // eslint-disable-next-line no-continue
      continue;

    return coinSelectUtils.finalize(inputs, outputs, feeRateNum);
  }

  return { fee: feeRateNum * bytesAccum };
}

export function accumulativePro(
  utxos: ICoinSelectInput[],
  outputs: ICoinSelectOutput[],
  feeRate: number,
): ICoinSelectResult {
  if (!Number.isFinite(coinSelectUtils.uintOrNaN(feeRate))) return {};
  let bytesAccum = coinSelectUtils.transactionBytes([], outputs);

  let inAccum = 0;
  const inputs = [];
  const outAccum = coinSelectUtils.sumOrNaN(outputs);

  for (let i = 0; i < utxos.length; i += 1) {
    const utxo = utxos[i];
    const utxoBytes = coinSelectUtils.inputBytes(utxo);
    const utxoFee = feeRate * utxoBytes;
    const utxoValue = coinSelectUtils.uintOrNaN(utxo.value);

    // skip detrimental input
    if (utxoFee > utxo.value) {
      if (i === utxos.length - 1)
        return { fee: feeRate * (bytesAccum + utxoBytes) };

      if (!utxo.forceSelect) {
        // **** dust utxo 546 sats won't select in default,
        //      it may cost more tx fee, but supply less value
        // eslint-disable-next-line no-continue
        continue;
      }
    }

    bytesAccum += utxoBytes;
    inAccum += utxoValue;
    inputs.push(utxo);

    const fee = feeRate * bytesAccum;

    // eslint-disable-next-line no-continue
    if (inAccum < outAccum + fee) continue;

    return coinSelectUtils.finalize(inputs, outputs, feeRate);
  }

  return { fee: feeRate * bytesAccum };
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

export function coinSelectAutoPro(
  utxos: ICoinSelectInput[],
  outputs: ICoinSelectOutput[],
  feeRate: number,
  useBlackjack = true,
): ICoinSelectResult {
  // eslint-disable-next-line no-param-reassign
  utxos = sortUtxo({
    utxos,
    feeRate,
  });

  if (useBlackjack) {
    // attempt to use the blackjack strategy first (no change output)
    const base = blackjackPro(utxos, outputs, feeRate);
    if (base.inputs) return base;
  }

  // else, try the accumulative strategy
  return accumulativePro(utxos, outputs, feeRate);
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

  return coinSelectAccumulative(utxos, outputs, feeRate);
}

export const coinSelect = ({
  inputsForCoinSelect,
  outputsForCoinSelect,
  feeRate,
  algorithm = 'auto',
}: ICoinSelectOptions): ICoinSelectResult => {
  const max = outputsForCoinSelect.some((o) => o.isMax);

  // valid amount
  const validAmount = outputsForCoinSelect.every((o) => {
    if (o.isMax) {
      return typeof o.value === 'undefined';
    }
    return typeof o.value === 'number' && !Number.isNaN(o.value);
  });
  if (!validAmount) {
    throw new Error(
      'coinSelect ERROR: Invalid amount in outputs, you should specify valid value or isMax',
    );
  }

  // remove isMax field
  const finalOutputs = outputsForCoinSelect.map((o) => ({
    address: o.address,
    value: o.isMax ? undefined : o.value,
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
    parseInt(feeRate),
  );

  if (isNil(fee)) {
    throw new Error('coinSelect ERROR: No fee found');
  }
  return { inputs, outputs, fee };
};
