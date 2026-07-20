import BigNumber from 'bignumber.js';

import appCrypto from '../appCrypto';

import bufferUtils from './bufferUtils';
import { countLeadingZeroDecimals } from './numberUtils';
import {
  type IPortfolioTokenIconName,
  normalizePortfolioTokenContractAddress,
  resolvePortfolioTokenIconName,
} from './portfolioTokenIcon';
import { stableStringify } from './stringUtils';

import type { ICurrencyItem } from '../../types/currency';
import type { IAccountToken, ITokenFiat } from '../../types/token';

export type IPortfolioDisplayCurrency = {
  id: string;
  symbol: string;
};

export type IPortfolioPayloadToken = {
  symbol: string;
  name: string;
  contractAddress: string;
  iconName: IPortfolioTokenIconName | null;
  isAllNetworks: boolean;
  isNative: boolean;
  balance: string;
  fiatValue: string;
  price: number;
  change24h: number;
  networkId: string;
};

export type IPortfolioPayload = {
  v: 1;
  ts: number;
  currency: string;
  currencySymbol: string;
  account: {
    label: string;
    addressMasked: string;
  };
  totalFiat: string;
  tokenCount: number;
  tokens: IPortfolioPayloadToken[];
  otherTokens: {
    count: number;
    fiat: string;
  };
};

export type IBuildPortfolioPayloadParams = {
  account: IPortfolioPayload['account'];
  aggregateTokenMap?: Record<string, ITokenFiat>;
  currencyMap: Record<string, ICurrencyItem>;
  displayCurrency: IPortfolioDisplayCurrency;
  totalFiat: string;
  totalTokenCount: number;
  timestamp: number;
  tokenMap: Record<string, ITokenFiat>;
  tokens: IAccountToken[];
};

type IConvertFiatStrictResult = {
  value: string | null;
  reason?: 'invalid-value' | 'missing-rate';
};

const PORTFOLIO_NATIVE_TOKEN_CONTRACT_NETWORK_IMPLS = new Set(['aptos', 'sui']);
const PORTFOLIO_TOKEN_LIMIT = 5;
const PORTFOLIO_FIAT_DECIMAL_PLACES = 2;
const PORTFOLIO_BALANCE_DECIMAL_PLACES = 4;

function formatPortfolioFiat(value: BigNumber.Value): string {
  const valueBn = new BigNumber(value);
  if (!valueBn.isFinite() || valueBn.isNegative()) {
    return '0.00';
  }
  return valueBn.toFixed(
    PORTFOLIO_FIAT_DECIMAL_PLACES,
    BigNumber.ROUND_HALF_UP,
  );
}

function formatPortfolioBalance(value: BigNumber.Value): string {
  const valueBn = new BigNumber(value);
  if (!valueBn.isFinite() || valueBn.isNegative()) {
    return '0';
  }
  const decimalPlaces = valueBn.abs().gte(1)
    ? PORTFOLIO_BALANCE_DECIMAL_PLACES
    : PORTFOLIO_BALANCE_DECIMAL_PLACES + countLeadingZeroDecimals(valueBn);
  return valueBn
    .decimalPlaces(decimalPlaces, BigNumber.ROUND_HALF_UP)
    .toFixed();
}

function formatPortfolioNumber(
  value: BigNumber.Value | null | undefined,
  { allowNegative = false }: { allowNegative?: boolean } = {},
): number {
  const valueBn = new BigNumber(value ?? NaN);
  if (!valueBn.isFinite() || (!allowNegative && valueBn.isNegative())) {
    return 0;
  }
  return valueBn.toNumber();
}

function isUsableRate(rate: BigNumber): boolean {
  return rate.isFinite() && !rate.isZero();
}

export function convertFiatStrictToDisplayCurrency({
  currencyMap,
  sourceCurrency,
  targetCurrency,
  value,
}: {
  currencyMap: Record<string, ICurrencyItem>;
  sourceCurrency?: string;
  targetCurrency: string;
  value: BigNumber.Value | null | undefined;
}): IConvertFiatStrictResult {
  if (value === null || value === undefined || value === '') {
    return { value: null, reason: 'invalid-value' };
  }

  const valueBn = new BigNumber(value);
  if (!valueBn.isFinite()) {
    return { value: null, reason: 'invalid-value' };
  }

  if (!sourceCurrency || sourceCurrency === targetCurrency) {
    return { value: valueBn.toFixed() };
  }

  const sourceRate = new BigNumber(currencyMap[sourceCurrency]?.value ?? NaN);
  const targetRate = new BigNumber(currencyMap[targetCurrency]?.value ?? NaN);
  if (!isUsableRate(sourceRate) || !isUsableRate(targetRate)) {
    return { value: null, reason: 'missing-rate' };
  }

  return { value: valueBn.div(sourceRate).times(targetRate).toFixed() };
}

function convertPriceStrictToDisplayCurrency({
  currencyMap,
  sourceCurrency,
  targetCurrency,
  value,
}: {
  currencyMap: Record<string, ICurrencyItem>;
  sourceCurrency?: string;
  targetCurrency: string;
  value: BigNumber.Value | null | undefined;
}): number {
  const converted = convertFiatStrictToDisplayCurrency({
    currencyMap,
    sourceCurrency,
    targetCurrency,
    value,
  });
  return formatPortfolioNumber(converted.value);
}

function getTokenFiat({
  aggregateTokenMap,
  token,
  tokenMap,
}: {
  aggregateTokenMap?: Record<string, ITokenFiat>;
  token: IAccountToken;
  tokenMap: Record<string, ITokenFiat>;
}): ITokenFiat | undefined {
  if (token.isAggregateToken) {
    return aggregateTokenMap?.[token.$key] ?? tokenMap[token.$key];
  }
  return tokenMap[token.$key];
}

function getNetworkImpl(networkId: string): string {
  return networkId.split('--')[0] ?? '';
}

function shouldKeepNativeTokenContractAddress({
  contractAddress,
  networkId,
}: {
  contractAddress: string;
  networkId: string;
}): boolean {
  return (
    Boolean(contractAddress) &&
    PORTFOLIO_NATIVE_TOKEN_CONTRACT_NETWORK_IMPLS.has(getNetworkImpl(networkId))
  );
}

function getPortfolioTokenContractAddress({
  isAllNetworks,
  isNative,
  networkId,
  tokenAddress,
}: {
  isAllNetworks: boolean;
  isNative: boolean;
  networkId: string;
  tokenAddress?: string;
}): string {
  if (isAllNetworks) {
    return '';
  }

  const normalizedContractAddress = normalizePortfolioTokenContractAddress({
    contractAddress: tokenAddress ?? '',
    networkId,
  });

  if (
    isNative &&
    !shouldKeepNativeTokenContractAddress({
      contractAddress: normalizedContractAddress,
      networkId,
    })
  ) {
    return '';
  }

  return normalizedContractAddress;
}

export function buildPortfolioPayload({
  account,
  aggregateTokenMap,
  currencyMap,
  displayCurrency,
  totalFiat: rawTotalFiat,
  totalTokenCount,
  timestamp,
  tokenMap,
  tokens,
}: IBuildPortfolioPayloadParams): IPortfolioPayload {
  const topTokens = tokens.slice(0, PORTFOLIO_TOKEN_LIMIT);
  let topTokensFiat = new BigNumber(0);

  const payloadTokens = topTokens.map((token) => {
    const isAllNetworks = Boolean(token.isAggregateToken);
    const isNative = isAllNetworks ? false : Boolean(token.isNative);
    const networkId = isAllNetworks ? '' : (token.networkId ?? '');
    const symbol = token.commonSymbol || token.symbol;
    const contractAddress = getPortfolioTokenContractAddress({
      isAllNetworks,
      isNative,
      networkId,
      tokenAddress: token.address,
    });
    const fiat = getTokenFiat({ aggregateTokenMap, token, tokenMap });
    const sourceCurrency = fiat?.currency;
    const convertedFiat = convertFiatStrictToDisplayCurrency({
      currencyMap,
      sourceCurrency,
      targetCurrency: displayCurrency.id,
      value: fiat?.fiatValue,
    });
    const fiatValue = formatPortfolioFiat(convertedFiat.value ?? 0);
    topTokensFiat = topTokensFiat.plus(fiatValue);

    return {
      balance: formatPortfolioBalance(fiat?.balanceParsed ?? '0'),
      change24h: formatPortfolioNumber(fiat?.price24h, {
        allowNegative: true,
      }),
      contractAddress,
      fiatValue,
      iconName: resolvePortfolioTokenIconName({
        contractAddress,
        isAllNetworks,
        isNative,
        networkId,
        symbol,
      }),
      isAllNetworks,
      isNative,
      name: token.name,
      networkId,
      price: convertPriceStrictToDisplayCurrency({
        currencyMap,
        sourceCurrency,
        targetCurrency: displayCurrency.id,
        value: fiat?.price,
      }),
      symbol,
    };
  });

  const totalFiat = formatPortfolioFiat(rawTotalFiat);
  const otherTokensFiat = BigNumber.maximum(
    new BigNumber(totalFiat).minus(topTokensFiat),
    0,
  ).toFixed(PORTFOLIO_FIAT_DECIMAL_PLACES);

  return {
    account,
    currency: displayCurrency.id,
    currencySymbol: displayCurrency.symbol,
    tokenCount: payloadTokens.length,
    tokens: payloadTokens,
    otherTokens: {
      count: Math.max(Math.trunc(totalTokenCount) - payloadTokens.length, 0),
      fiat: otherTokensFiat,
    },
    totalFiat,
    ts: timestamp,
    v: 1,
  };
}

export function buildPortfolioPayloadHash(payload: IPortfolioPayload): string {
  const { ts: _ts, ...content } = payload;
  return bufferUtils.bytesToHex(
    appCrypto.hash.sha256Sync(Buffer.from(stableStringify(content), 'utf8')),
  );
}
