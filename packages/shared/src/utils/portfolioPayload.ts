import BigNumber from 'bignumber.js';

import appCrypto from '../appCrypto';

import bufferUtils from './bufferUtils';
import { formatBalance, formatDisplayNumber, formatValue } from './numberUtils';
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
  portfolioPercentage: number;
  networkId: string;
};

export type IPortfolioPayload = {
  v: 1;
  ts: number;
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
    portfolioPercentage: number;
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
const PORTFOLIO_PERCENTAGE_DECIMAL_PLACES = 2;

function toPortfolioAllocationValue(value: BigNumber.Value): BigNumber {
  const valueBn = new BigNumber(value);
  if (!valueBn.isFinite() || valueBn.isNegative()) {
    return new BigNumber(0);
  }
  return valueBn;
}

function displayNumberToString(
  value: ReturnType<typeof formatDisplayNumber>,
): string {
  if (typeof value === 'string') {
    return value;
  }
  return value
    .map((part) => (typeof part === 'string' ? part : String(part.value)))
    .join('');
}

function formatPortfolioFiat(
  value: BigNumber.Value,
  currencySymbol: string,
): string {
  const normalizedValue = toPortfolioAllocationValue(value).toFixed();
  return displayNumberToString(
    formatDisplayNumber(
      formatValue(normalizedValue, { currency: currencySymbol }),
    ),
  );
}

function formatPortfolioBalance(value: BigNumber.Value): string {
  const valueBn = new BigNumber(value);
  const normalizedValue =
    valueBn.isFinite() && !valueBn.isNegative() ? valueBn.toFixed() : '0';
  return displayNumberToString(
    formatDisplayNumber(
      formatBalance(normalizedValue, { keepLeadingZero: true }),
    ),
  );
}

function calculatePortfolioPercentages(values: BigNumber[]): number[] {
  const total = BigNumber.sum(...values);
  if (!total.isFinite() || total.lte(0)) {
    return values.map(() => 0);
  }

  let absorberIndex = 0;
  for (let index = 1; index < values.length; index += 1) {
    if (values[index].gt(values[absorberIndex])) {
      absorberIndex = index;
    }
  }

  const percentages = values.map((value, index) =>
    index === absorberIndex || value.lte(0)
      ? new BigNumber(0)
      : value
          .times(100)
          .div(total)
          .decimalPlaces(
            PORTFOLIO_PERCENTAGE_DECIMAL_PLACES,
            BigNumber.ROUND_HALF_UP,
          ),
  );
  const assigned = BigNumber.sum(...percentages);
  percentages[absorberIndex] = BigNumber.maximum(
    new BigNumber(100).minus(assigned),
    0,
  ).decimalPlaces(PORTFOLIO_PERCENTAGE_DECIMAL_PLACES);
  return percentages.map((value) => value.toNumber());
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

  const tokenBuildResults = topTokens.map((token) => {
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
    const allocationValue = toPortfolioAllocationValue(
      convertedFiat.value ?? 0,
    );
    const iconName = resolvePortfolioTokenIconName({
      contractAddress,
      isAllNetworks,
      isNative,
      networkId,
      symbol,
    });

    return {
      allocationValue,
      payload: {
        balance: formatPortfolioBalance(fiat?.balanceParsed ?? '0'),
        contractAddress,
        fiatValue: formatPortfolioFiat(allocationValue, displayCurrency.symbol),
        iconName,
        isAllNetworks,
        isNative,
        name: token.name,
        networkId,
        portfolioPercentage: 0,
        symbol,
      },
    };
  });

  const totalFiatValue = toPortfolioAllocationValue(rawTotalFiat);
  const topTokensFiatValue = tokenBuildResults.reduce(
    (total, result) => total.plus(result.allocationValue),
    new BigNumber(0),
  );
  const otherTokensFiatValue = BigNumber.maximum(
    totalFiatValue.minus(topTokensFiatValue),
    0,
  );
  const percentages = calculatePortfolioPercentages([
    ...tokenBuildResults.map((result) => result.allocationValue),
    otherTokensFiatValue,
  ]);
  const payloadTokens = tokenBuildResults.map((result, index) => ({
    ...result.payload,
    portfolioPercentage: percentages[index],
  }));

  return {
    account,
    tokenCount: payloadTokens.length,
    tokens: payloadTokens,
    otherTokens: {
      count: Math.max(Math.trunc(totalTokenCount) - payloadTokens.length, 0),
      fiat: formatPortfolioFiat(otherTokensFiatValue, displayCurrency.symbol),
      portfolioPercentage: percentages[payloadTokens.length] ?? 0,
    },
    totalFiat: formatPortfolioFiat(totalFiatValue, displayCurrency.symbol),
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
