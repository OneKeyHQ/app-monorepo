import { getBtcForkNetwork } from '@onekeyhq/core/src/chains/btc/sdkBtc';
import {
  EOutputsTypeForCoinSelect,
  type IBtcInput,
  type IBtcOutput,
  type ICoinSelectUTXO,
  type IEncodedTxBtc,
  type IOutputsForCoinSelect,
} from '@onekeyhq/core/src/chains/btc/types';
import type { ICoreApiSignBtcExtraInfo } from '@onekeyhq/core/src/types';
import {
  coinSelectWithWitness,
  getCoinSelectTxType,
} from '@onekeyhq/core/src/utils/coinSelectUtils';

import { AppError, ERROR_CODES } from '../../errors';
import { apiClient } from '../../infra';
import {
  amountToSmallestUnit,
  validateAmountDecimals,
} from '../../utils/tx-utils';

import type { IBtcAddressTypeInfo } from './address-types';

interface IBtcAccountUtxo {
  txid?: string;
  txId?: string;
  vout: number;
  value: string | number;
  amount?: string;
  address?: string;
  path?: string;
  confirmations?: number;
  rawTx?: string;
  nonWitnessPrevTx?: string;
}

interface IBtcAccountResponse {
  utxoList?: IBtcAccountUtxo[];
}

type NumberLike = string | number;

interface ICoinSelectSelectedInput {
  txId?: string;
  txid?: string;
  vout: number;
  value?: NumberLike;
  amount?: string;
  address?: string;
  path?: string;
}

interface ICoinSelectSelectedOutput {
  type?: string;
  address: string;
  value?: NumberLike;
  amount?: NumberLike;
  path?: string;
  dataHex?: string;
}

export interface IBuildBtcTransferTxParams {
  impl: string;
  networkId: string;
  fromAddress: string;
  fromPath: string;
  toAddress: string;
  amount: string;
  nativeDecimals: number;
  feeRate: string;
  addressTypeInfo: IBtcAddressTypeInfo;
  opReturn?: string;
}

export interface IBuildBtcTransferTxResult {
  encodedTx: IEncodedTxBtc;
  btcExtraInfo: ICoreApiSignBtcExtraInfo;
  relPaths: string[];
  summary: {
    fee: string;
    txSize: number;
    inputCount: number;
    outputCount: number;
  };
}

function getUtxoTxid(utxo: IBtcAccountUtxo): string | undefined {
  return utxo.txid ?? utxo.txId;
}

function normalizeUtxoValue(value: string | number): {
  valueNumber: number;
  amount: string;
} {
  const amount = String(value);
  const valueNumber = Number(amount);
  if (
    !Number.isSafeInteger(valueNumber) ||
    valueNumber <= 0 ||
    !/^\d+$/.test(amount)
  ) {
    throw new AppError(
      ERROR_CODES.BIZ_UNKNOWN.code,
      'Invalid BTC UTXO value.',
      'Retry after the account UTXO data is refreshed.',
      { details: { value } },
    );
  }
  return { valueNumber, amount };
}

function normalizeCoinSelectAmount(value: unknown): number | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return undefined;
  }
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < 0) {
    return undefined;
  }
  return amount;
}

function getSelectedOutputAmount(
  output: ICoinSelectSelectedOutput,
): number | undefined {
  return normalizeCoinSelectAmount(output.value ?? output.amount);
}

function getRelPath(fullPath: string, fallbackRelPath: string): string {
  const parts = fullPath.split('/').filter(Boolean);
  if (parts.length >= 2) {
    return parts.slice(-2).join('/');
  }
  return fallbackRelPath;
}

function createCoinSelectionError(params: {
  inputCount: number;
  outputCount: number;
  paymentAmount: string;
}): AppError {
  return new AppError(
    ERROR_CODES.BIZ_INSUFFICIENT_BALANCE.code,
    'BTC coin selection failed.',
    'Reduce the amount or retry after UTXOs are confirmed.',
    { details: params },
  );
}

function assertCoinSelectionComplete(params: {
  inputs?: unknown[];
  outputs?: unknown[];
  fee?: NumberLike;
  bytes?: number;
  inputCount: number;
  outputCount: number;
  paymentAmount: string;
}): asserts params is {
  inputs: ICoinSelectSelectedInput[];
  outputs: ICoinSelectSelectedOutput[];
  fee: NumberLike;
  bytes: number;
  inputCount: number;
  outputCount: number;
  paymentAmount: string;
} {
  if (
    !Array.isArray(params.inputs) ||
    params.inputs.length === 0 ||
    !Array.isArray(params.outputs) ||
    params.outputs.length === 0 ||
    params.fee === undefined ||
    params.bytes === undefined ||
    params.inputs.some((input) => {
      const selectedInput = input as ICoinSelectSelectedInput;
      return (
        !(selectedInput.txId ?? selectedInput.txid) ||
        !Number.isInteger(selectedInput.vout) ||
        selectedInput.vout < 0 ||
        selectedInput.value === undefined
      );
    }) ||
    params.outputs.some((output) => {
      const selectedOutput = output as ICoinSelectSelectedOutput;
      if (selectedOutput.type === EOutputsTypeForCoinSelect.OpReturn) {
        return typeof selectedOutput.dataHex !== 'string';
      }
      return (
        !selectedOutput.address ||
        getSelectedOutputAmount(selectedOutput) === undefined
      );
    })
  ) {
    throw createCoinSelectionError({
      inputCount: params.inputCount,
      outputCount: params.outputCount,
      paymentAmount: params.paymentAmount,
    });
  }
}

function buildInputLookup(
  utxos: IBtcAccountUtxo[],
): Map<string, IBtcAccountUtxo> {
  const lookup = new Map<string, IBtcAccountUtxo>();
  for (const utxo of utxos) {
    const txid = getUtxoTxid(utxo);
    if (txid) {
      lookup.set(`${txid}:${utxo.vout}`, utxo);
    }
  }
  return lookup;
}

export async function buildBtcTransferTx(
  params: IBuildBtcTransferTxParams,
): Promise<IBuildBtcTransferTxResult> {
  validateAmountDecimals(params.amount, params.nativeDecimals);
  const paymentAmount = amountToSmallestUnit(
    params.amount,
    params.nativeDecimals,
  );
  const paymentAmountNumber = Number(paymentAmount);

  if (!Number.isSafeInteger(paymentAmountNumber) || paymentAmountNumber <= 0) {
    throw new AppError(
      ERROR_CODES.PARAM_INVALID_AMOUNT.code,
      'BTC transfer amount must be greater than zero.',
      'Enter a positive BTC amount.',
    );
  }

  const account = await apiClient.get<IBtcAccountResponse>(
    'wallet',
    '/wallet/v1/account/get-account',
    {
      networkId: params.networkId,
      accountAddress: params.fromAddress,
      withUTXOList: true,
      withNetWorth: true,
    },
  );

  const utxos = account.utxoList ?? [];
  if (utxos.length === 0) {
    throw new AppError(
      ERROR_CODES.BIZ_INSUFFICIENT_BALANCE.code,
      'No usable BTC UTXOs found.',
      'Fund the selected BTC address or wait for UTXOs to confirm.',
      { details: { address: params.fromAddress, networkId: params.networkId } },
    );
  }

  const inputLookup = buildInputLookup(utxos);
  const seenUtxoKeys = new Set<string>();
  const inputsForCoinSelect: ICoinSelectUTXO[] = utxos.map((utxo) => {
    const txId = getUtxoTxid(utxo);
    if (!txId) {
      throw new AppError(
        ERROR_CODES.BIZ_UNKNOWN.code,
        'BTC UTXO is missing txid.',
        'Retry after the account UTXO data is refreshed.',
      );
    }

    const utxoKey = `${txId}:${utxo.vout}`;
    if (seenUtxoKeys.has(utxoKey)) {
      throw new AppError(
        ERROR_CODES.BIZ_UNKNOWN.code,
        `Duplicate BTC UTXO from API: ${utxoKey}`,
        'Retry after the account UTXO data is refreshed.',
      );
    }
    seenUtxoKeys.add(utxoKey);

    const { valueNumber, amount } = normalizeUtxoValue(utxo.value);
    return {
      txId,
      vout: utxo.vout,
      value: valueNumber,
      amount,
      address: utxo.address ?? params.fromAddress,
      path: utxo.path ?? params.fromPath,
      confirmations: utxo.confirmations,
    };
  });

  const outputsForCoinSelect: IOutputsForCoinSelect = [
    {
      type: EOutputsTypeForCoinSelect.Payment,
      address: params.toAddress,
      value: paymentAmountNumber,
      amount: paymentAmount,
    },
  ];
  if (params.opReturn) {
    const opReturnBytes = Buffer.byteLength(params.opReturn, 'utf8');
    if (opReturnBytes > 80) {
      throw new AppError(
        ERROR_CODES.PARAM_INVALID_CONFIG.code,
        `OP_RETURN payload is ${opReturnBytes} bytes, exceeds the 80-byte standard relay limit`,
        'Use a shorter memo or contact the swap provider',
      );
    }
    outputsForCoinSelect.push({
      type: EOutputsTypeForCoinSelect.OpReturn,
      address: '',
      dataHex: Buffer.from(params.opReturn).toString('hex'),
    });
  }

  const selection = coinSelectWithWitness({
    inputsForCoinSelect,
    outputsForCoinSelect,
    feeRate: params.feeRate,
    network: getBtcForkNetwork(params.impl),
    changeAddress: {
      address: params.fromAddress,
      path: params.fromPath,
    },
    txType: getCoinSelectTxType(params.addressTypeInfo.addressEncoding),
  });

  const errCtx = {
    inputCount: inputsForCoinSelect.length,
    outputCount: outputsForCoinSelect.length,
    paymentAmount,
  };
  const selectionResult = { ...selection, ...errCtx };
  assertCoinSelectionComplete(selectionResult);

  const selectedInputs =
    selectionResult.inputs as unknown as ICoinSelectSelectedInput[];
  const selectedOutputs =
    selectionResult.outputs as unknown as ICoinSelectSelectedOutput[];

  const inputs: IBtcInput[] = selectedInputs.map((input) => {
    const txid = input.txId ?? input.txid;
    if (!txid) {
      throw createCoinSelectionError(errCtx);
    }
    return {
      txid,
      vout: input.vout,
      value: String(input.value),
      address: input.address ?? params.fromAddress,
      path: input.path ?? params.fromPath,
    };
  });

  let paymentOutputConsumed = false;
  const outputs: IBtcOutput[] = selectedOutputs.map((output) => {
    if (output.type === EOutputsTypeForCoinSelect.OpReturn) {
      return {
        address: '',
        value: '0',
        payload: { opReturn: params.opReturn ?? '' },
      };
    }

    const outputValue = getSelectedOutputAmount(output);
    if (outputValue === undefined) {
      throw createCoinSelectionError(errCtx);
    }
    const isPaymentOutput =
      !paymentOutputConsumed &&
      output.address === params.toAddress &&
      outputValue === paymentAmountNumber;
    if (isPaymentOutput) {
      paymentOutputConsumed = true;
      return {
        address: output.address,
        value: String(outputValue),
      };
    }

    const isChange = output.address === params.fromAddress;
    return {
      address: output.address,
      value: String(outputValue),
      ...(isChange
        ? {
            payload: {
              isChange: true,
              bip44Path: output.path ?? params.fromPath,
            },
          }
        : {}),
    };
  });

  const pathToAddresses: ICoreApiSignBtcExtraInfo['pathToAddresses'] = {};
  const addressToPath: ICoreApiSignBtcExtraInfo['addressToPath'] = {};
  const nonWitnessPrevTxs: NonNullable<
    ICoreApiSignBtcExtraInfo['nonWitnessPrevTxs']
  > = {};

  for (const input of inputs) {
    const originalUtxo = inputLookup.get(`${input.txid}:${input.vout}`);
    const address =
      originalUtxo?.address ?? input.address ?? params.fromAddress;
    const fullPath = originalUtxo?.path ?? input.path ?? params.fromPath;
    const relPath = getRelPath(fullPath, params.addressTypeInfo.relPath);
    const pathItem = { address, relPath, fullPath };

    pathToAddresses[fullPath] = pathItem;
    addressToPath[address] = pathItem;

    const prevTx = originalUtxo?.rawTx ?? originalUtxo?.nonWitnessPrevTx;
    if (prevTx) {
      nonWitnessPrevTxs[input.txid] = prevTx;
    }
  }

  const encodedTx: IEncodedTxBtc = {
    inputs,
    outputs,
    inputsForCoinSelect,
    outputsForCoinSelect,
    fee: String(selectionResult.fee),
    txSize: selectionResult.bytes,
  };

  return {
    encodedTx,
    btcExtraInfo: {
      pathToAddresses,
      addressToPath,
      inputAddressesEncodings: inputs.map(
        () => params.addressTypeInfo.addressEncoding,
      ),
      nonWitnessPrevTxs,
    },
    relPaths: [params.addressTypeInfo.relPath],
    summary: {
      fee: String(selectionResult.fee),
      txSize: selectionResult.bytes,
      inputCount: inputs.length,
      outputCount: outputs.length,
    },
  };
}
