import BigNumber from 'bignumber.js';

import type { Network } from '@onekeyhq/engine/src/types/network';
import type { Token } from '@onekeyhq/engine/src/types/token';
import type {
  IDecodedTx,
  IFeeInfoUnit,
} from '@onekeyhq/engine/src/vaults/types';
import {
  calculateTotalFeeNative,
  calculateTotalFeeRange,
} from '@onekeyhq/engine/src/vaults/utils/feeInfoUtils';
import { IMPL_EVM, IMPL_SOL } from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { networkIdDontSupportRecipientAddress } from './config';
import { QuoterType } from './typings';

import type {
  BuildTransactionParams,
  FetchQuoteParams,
  ILimitOrderQuoteParams,
  LimitOrderTransactionDetails,
  ProtocolFees,
  TransactionDetails,
} from './typings';

export const nativeTokenAddress = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
export const feeRecipient = '0xc1e92BD5d1aa6e5f5F299D0490BefD9D8E5a887a';
export const affiliateAddress = '0x4F5FC02bE49Bea15229041b87908148b04c14717';

export class TokenAmount {
  amount: BigNumber;

  decimals: BigNumber;

  value: BigNumber;

  base = new BigNumber(10);

  constructor(public token: Token, public typedValue: string) {
    this.value = new BigNumber(typedValue);
    this.decimals = new BigNumber(token.decimals);
    this.amount = this.base
      .exponentiatedBy(this.decimals)
      .multipliedBy(this.value);
  }

  toNumber() {
    return this.amount;
  }

  toFormat() {
    return this.toNumber().toFixed(0);
  }
}

export function getTokenAmountString(token: Token, amount: string) {
  const tokenAmount = new TokenAmount(token, amount);
  return tokenAmount.toFormat();
}

export function getTokenAmountValue(token: Token, amount: string) {
  const bn = new BigNumber(amount);
  const decimals = new BigNumber(token.decimals);
  const base = new BigNumber(10);
  const value = bn.dividedBy(base.exponentiatedBy(decimals));
  return value;
}

export function multiply(a: BigNumber.Value, b: BigNumber.Value): string {
  const num1 = new BigNumber(a);
  const num2 = new BigNumber(b);
  if (!BigNumber.isBigNumber(num1) || !BigNumber.isBigNumber(num2)) {
    return '0';
  }
  return num1.multipliedBy(num2).toFixed();
}

export function div(a: BigNumber.Value, b: BigNumber.Value): string {
  const num1 = new BigNumber(a);
  const num2 = new BigNumber(b);
  if (!BigNumber.isBigNumber(num1) || !BigNumber.isBigNumber(num2)) {
    return '0';
  }
  return num1.div(num2).toFixed();
}

export function plus(a: BigNumber.Value, b: BigNumber.Value): string {
  const num1 = new BigNumber(a);
  const num2 = new BigNumber(b);
  if (!BigNumber.isBigNumber(num1) || !BigNumber.isBigNumber(num2)) {
    return '0';
  }
  return num1.plus(num2).toFixed();
}

export function minus(a: BigNumber.Value, b: BigNumber.Value): string {
  const num1 = new BigNumber(a);
  const num2 = new BigNumber(b);
  if (!BigNumber.isBigNumber(num1) || !BigNumber.isBigNumber(num2)) {
    return '0';
  }
  return num1.minus(num2).toFixed();
}

export function gte(a: BigNumber.Value, b: BigNumber.Value): boolean {
  const num1 = new BigNumber(a);
  const num2 = new BigNumber(b);
  if (!BigNumber.isBigNumber(num1) || !BigNumber.isBigNumber(num2)) {
    return false;
  }
  return num1.gte(num2);
}

export function gt(a: BigNumber.Value, b: BigNumber.Value): boolean {
  const num1 = new BigNumber(a);
  const num2 = new BigNumber(b);
  if (!BigNumber.isBigNumber(num1) || !BigNumber.isBigNumber(num2)) {
    return false;
  }
  return num1.gt(num2);
}

export function lte(a: BigNumber.Value, b: BigNumber.Value): boolean {
  const num1 = new BigNumber(a);
  const num2 = new BigNumber(b);
  if (!BigNumber.isBigNumber(num1) || !BigNumber.isBigNumber(num2)) {
    return false;
  }
  return num1.lte(num2);
}

export function lt(a: BigNumber.Value, b: BigNumber.Value): boolean {
  const num1 = new BigNumber(a);
  const num2 = new BigNumber(b);
  if (!BigNumber.isBigNumber(num1) || !BigNumber.isBigNumber(num2)) {
    return false;
  }
  return num1.lt(num2);
}

export function tokenBN(value: BigNumber.Value, decimals: BigNumber.Value) {
  return new BigNumber(10).exponentiatedBy(decimals).multipliedBy(value);
}

export function greaterThanZeroOrUndefined(value?: string) {
  if (!value || Number.isNaN(value)) {
    return undefined;
  }
  const num = Number(value);
  return num > 0 ? value : undefined;
}

export function formatAmount(
  value?: BigNumber.Value,
  precision = 4,
  roundingMode: BigNumber.RoundingMode = BigNumber.ROUND_HALF_UP,
) {
  if (!value) {
    return '';
  }
  const bn = new BigNumber(value);
  if (bn.isNaN()) {
    return '';
  }
  return bn.decimalPlaces(precision, roundingMode).toFixed();
}

export function formatAmountExact(value?: BigNumber.Value, basePrecision = 4) {
  if (!value) {
    return '';
  }
  const bn = new BigNumber(value);
  let precision = 0;
  for (let i = 0; i <= 4; i += 1) {
    precision += basePrecision;
    const result = formatAmount(bn, precision, BigNumber.ROUND_FLOOR);
    const v = bn.minus(result).abs().div(bn).lt(0.01);
    if (v) {
      return result;
    }
  }
  return formatAmount(bn, Math.max(4, precision), BigNumber.ROUND_FLOOR);
}

export function calculateRate(
  inDecimals: number,
  outDecimals: number,
  inNum: number | string,
  outNum: number | string,
): string {
  const result = new BigNumber(10 ** inDecimals)
    .multipliedBy(outNum)
    .div(10 ** outDecimals)
    .div(inNum);
  return result.toFixed();
}

export function getChainIdFromNetwork(network?: Network): string {
  const chainId = network?.extraInfo?.chainId;
  return network ? String(+chainId) : '';
}

export function getChainIdFromNetworkId(networdId: string) {
  return networdId.split('--')[1] ?? '';
}

export function getNetworkIdImpl(networdId?: string) {
  if (!networdId) {
    return;
  }
  return networdId.split('--')[0];
}

export function isEvmNetworkId(networdId?: string) {
  return getNetworkIdImpl(networdId) === IMPL_EVM;
}

export function isSolNetworkId(networdId?: string) {
  return getNetworkIdImpl(networdId) === IMPL_SOL;
}

export function getEvmTokenAddress(token: Token) {
  return token.tokenIdOnNetwork ? token.tokenIdOnNetwork : nativeTokenAddress;
}

export function calculateRange(
  values: { max?: BigNumber.Value; min?: BigNumber.Value }[],
): {
  max?: string;
  min?: string;
} {
  const maxValues = values.map((item) => item.max).filter(Boolean);
  const minValues = values.map((item) => item.min).filter(Boolean);
  return {
    max:
      maxValues.length > 0 ? BigNumber.max(...maxValues).toFixed() : undefined,
    min:
      minValues.length > 0 ? BigNumber.min(...minValues).toFixed() : undefined,
  };
}

export function stringifyTokens(a?: Token, b?: Token) {
  if (!a || !b) {
    return '';
  }
  const input = `input:${a.networkId}-${b.tokenIdOnNetwork}`;
  const output = `output:${a.networkId}-${b.tokenIdOnNetwork}`;
  return `${input}|${output} `;
}

export function convertParams(params: FetchQuoteParams) {
  if (!params.receivingAddress) {
    return;
  }
  const toNetworkId = params.networkOut.id;
  const fromNetworkId = params.networkIn.id;

  const toTokenAddress = params.tokenOut.tokenIdOnNetwork
    ? params.tokenOut.tokenIdOnNetwork
    : nativeTokenAddress;
  const fromTokenAddress = params.tokenIn.tokenIdOnNetwork
    ? params.tokenIn.tokenIdOnNetwork
    : nativeTokenAddress;

  const toTokenDecimals = params.tokenOut.decimals;
  const fromTokenDecimals = params.tokenIn.decimals;

  const { slippagePercentage, receivingAddress } = params;
  const userAddress = params.activeAccount.address;

  let toTokenAmount: string | undefined;
  let fromTokenAmount: string | undefined;

  if (params.independentField === 'INPUT') {
    fromTokenAmount = getTokenAmountString(params.tokenIn, params.typedValue);
  } else {
    toTokenAmount = getTokenAmountString(params.tokenOut, params.typedValue);
  }

  const urlParams: Record<string, string | number | boolean> = {
    toNetworkId,
    fromNetworkId,
    toTokenAddress,
    fromTokenAddress,
    toTokenDecimals,
    fromTokenDecimals,
    slippagePercentage,
    userAddress,
    receivingAddress,
  };

  if (fromTokenAmount) {
    urlParams.fromTokenAmount = fromTokenAmount;
  }
  if (toTokenAmount) {
    urlParams.toTokenAmount = toTokenAmount;
  }
  if (params.onChainSatsPerVbyte) {
    urlParams.onChainSatsPerVbyte = params.onChainSatsPerVbyte;
  }
  urlParams.includes =
    '0x,1inch,jupiter,openocean,swftc,socket,mdex,Deezy,Thorswap,ThorswapStream';
  urlParams.noFilter = true;
  return urlParams;
}

export function convertLimitOrderParams(params: ILimitOrderQuoteParams) {
  const toNetworkId = params.tokenIn.networkId;
  const fromNetworkId = params.tokenOut.networkId;

  const toTokenAddress = params.tokenOut.tokenIdOnNetwork
    ? params.tokenOut.tokenIdOnNetwork
    : nativeTokenAddress;
  const fromTokenAddress = params.tokenIn.tokenIdOnNetwork
    ? params.tokenIn.tokenIdOnNetwork
    : nativeTokenAddress;

  const toTokenDecimals = params.tokenOut.decimals;
  const fromTokenDecimals = params.tokenIn.decimals;

  const userAddress = params.activeAccount.address;

  const fromTokenAmount = getTokenAmountString(
    params.tokenIn,
    params.tokenInValue,
  );

  const urlParams: Record<string, string | number | boolean> = {
    toNetworkId,
    fromNetworkId,
    toTokenAddress,
    fromTokenAddress,
    toTokenDecimals,
    fromTokenDecimals,
    slippagePercentage: 1,
    userAddress,
    receivingAddress: params.activeAccount.address,
  };

  if (fromTokenAmount) {
    urlParams.fromTokenAmount = fromTokenAmount;
  }
  return urlParams;
}

export function convertBuildParams(params: BuildTransactionParams) {
  const urlParams = convertParams(params);
  if (!urlParams) {
    return;
  }
  urlParams.fromTokenAmount = params.sellAmount;
  delete urlParams.toTokenAmount;
  return urlParams;
}

export const normalizeProviderName = (text: string) => {
  if (text === 'swftc') {
    return 'SWFT';
  }
  return text;
};

export const calculateProtocalsFee = (protocolFees: ProtocolFees) => {
  const { amount, asset } = protocolFees;
  const bn = new BigNumber(amount);
  const decimals = new BigNumber(asset.decimals);
  const base = new BigNumber(10);
  const value = bn.dividedBy(base.exponentiatedBy(decimals)).toFixed();
  return { value, symbol: asset.symbol };
};

export function calculateDecodedTxNetworkFee(
  decodedTx: IDecodedTx,
  network: Network,
) {
  const { feeInfo, totalFeeInNative } = decodedTx;
  if (totalFeeInNative) {
    return totalFeeInNative;
  }
  if (feeInfo) {
    const feeRange = calculateTotalFeeRange(feeInfo, network.feeDecimals);
    const calculatedTotalFeeInNative = calculateTotalFeeNative({
      amount: feeRange.max,
      info: {
        defaultPresetIndex: '0',
        prices: [],
        feeSymbol: network.feeSymbol,
        feeDecimals: network.feeDecimals,
        nativeSymbol: network.symbol,
        nativeDecimals: network.decimals,
      },
    });
    return calculatedTotalFeeInNative;
  }
}

export function calculateNetworkFee(feeInfo: IFeeInfoUnit, network: Network) {
  const feeRange = calculateTotalFeeRange(feeInfo, network.feeDecimals);
  const calculatedTotalFeeInNative = calculateTotalFeeNative({
    amount: feeRange.max,
    info: {
      defaultPresetIndex: '0',
      prices: [],
      feeSymbol: network.feeSymbol,
      feeDecimals: network.feeDecimals,
      nativeSymbol: network.symbol,
      nativeDecimals: network.decimals,
    },
  });
  return calculatedTotalFeeInNative;
}

export function getQuoteType(tx: TransactionDetails): QuoterType {
  if (tx.quoterType) {
    return tx.quoterType;
  }
  if (tx.thirdPartyOrderId) {
    return QuoterType.swftc;
  }
  return QuoterType.zeroX;
}

export function isSimpleTx(tx: TransactionDetails) {
  const from = tx.tokens?.from;
  const to = tx.tokens?.to;
  const quoterType = getQuoteType(tx);
  if (quoterType === QuoterType.swftc || quoterType === QuoterType.jupiter) {
    return false;
  }
  return from?.networkId === to?.networkId;
}

export function tokenEqual(tokenA: Token, tokenB: Token) {
  return (
    tokenA.networkId === tokenB.networkId &&
    tokenA.tokenIdOnNetwork.toLowerCase() ===
      tokenB.tokenIdOnNetwork.toLowerCase()
  );
}

export function recipientMustBeSendingAccount(
  tokenA: Token,
  tokenB: Token,
  allowAnotherRecipientAddress?: boolean,
) {
  if (
    tokenA.networkId === tokenB.networkId &&
    networkIdDontSupportRecipientAddress.includes(tokenA.networkId)
  ) {
    return true;
  }
  const implA = getNetworkIdImpl(tokenA.networkId);
  const implB = getNetworkIdImpl(tokenB.networkId);
  return implA === implB && !allowAnotherRecipientAddress;
}

export function shouldShowAllowRecipientAddressInput(
  tokenA: Token,
  tokenB: Token,
) {
  const implA = getNetworkIdImpl(tokenA.networkId);
  const implB = getNetworkIdImpl(tokenB.networkId);
  let result = implA === implB;
  if (tokenA.networkId === tokenB.networkId) {
    result = !networkIdDontSupportRecipientAddress.includes(tokenA.networkId);
  }
  return result;
}

export function getLimitOrderPercent(limitOrder: LimitOrderTransactionDetails) {
  return multiply(
    div(
      minus(limitOrder.tokenOutValue, limitOrder.remainingFillable),
      limitOrder.tokenOutValue,
    ),
    100,
  );
}

export enum LoggerTimerTags {
  overview = 'overview',
  approval = 'approval',
  cancelApproval = 'cancelApproval',
  swap = 'swap',
  sendTransaction = 'sendTransaction',
  signMessage = 'signMessage',
  gasEstimate = 'gasEstimate',

  checkTokenBalance = 'checkTokenBalance',
  checkTokenAllowance = 'checkTokenAllowance',
  buildTransaction = 'buildTransaction',
}

export function createLoggerTimer() {
  let ref: Record<string, number> = {};
  return {
    start: (tag: string) => {
      const now = Date.now();
      if (ref[tag]) {
        debugLogger.swap.info(
          `tag ${tag} already exists, it's value ${ref[tag]} will be replace with ${now}`,
        );
      }
      ref[tag] = now;
    },
    end: (tag: string) => {
      const startAt = ref[tag];
      const now = Date.now();
      if (!startAt) {
        debugLogger.swap.info(`tag ${tag} ended at ${now}`);
      } else {
        const spent = ((now - startAt) / 1000).toFixed(2);
        debugLogger.swap.info(
          `tag ${tag} took ${spent} secords, ended at ${now}`,
        );
      }
    },
    clear: () => {
      ref = {};
    },
  };
}

export type Task = (nextTask?: () => Promise<void>) => Promise<void>;

export async function combinedTasks(tasks: Task[]) {
  let index = 0;
  async function next() {
    if (index < tasks.length) {
      const callback = tasks[index];
      index += 1;
      await callback(next);
    }
  }
  await next();
}

export const truncate = (content: string, max: number) =>
  content.length > max ? `${content.slice(0, max)}...` : content;

export const toHex = (text: string) => {
  if (text.startsWith('0x')) {
    return text;
  }
  return `0x${new BigNumber(text).toString(16)}`;
};
