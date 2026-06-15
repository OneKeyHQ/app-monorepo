import BigNumber from 'bignumber.js';

import appCrypto from '../appCrypto';

import bufferUtils from './bufferUtils';
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
  fiatValue: string | null;
  price: number | null;
  change24h: number | null;
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
  totalFiat: string | null;
  tokenCount: number;
  tokens: IPortfolioPayloadToken[];
};

export type IBuildPortfolioPayloadParams = {
  account: IPortfolioPayload['account'];
  aggregateTokenMap?: Record<string, ITokenFiat>;
  currencyMap: Record<string, ICurrencyItem>;
  displayCurrency: IPortfolioDisplayCurrency;
  timestamp: number;
  tokenMap: Record<string, ITokenFiat>;
  tokens: IAccountToken[];
};

type IConvertFiatStrictResult = {
  value: string | null;
  reason?: 'invalid-value' | 'missing-rate';
};

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
}): number | null {
  const converted = convertFiatStrictToDisplayCurrency({
    currencyMap,
    sourceCurrency,
    targetCurrency,
    value,
  });
  return converted.value === null
    ? null
    : new BigNumber(converted.value).toNumber();
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

export function buildPortfolioPayload({
  account,
  aggregateTokenMap,
  currencyMap,
  displayCurrency,
  timestamp,
  tokenMap,
  tokens,
}: IBuildPortfolioPayloadParams): IPortfolioPayload {
  const topTokens = tokens.slice(0, 10);
  let hasNullTopFiat = false;
  let totalFiat = new BigNumber(0);

  const payloadTokens = topTokens.map((token) => {
    const isAllNetworks = Boolean(token.isAggregateToken);
    const isNative = isAllNetworks ? false : Boolean(token.isNative);
    const networkId = isAllNetworks ? '' : (token.networkId ?? '');
    const symbol = token.commonSymbol || token.symbol;
    const contractAddress =
      isAllNetworks || isNative
        ? ''
        : normalizePortfolioTokenContractAddress({
            contractAddress: token.address ?? '',
            networkId,
          });
    const fiat = getTokenFiat({ aggregateTokenMap, token, tokenMap });
    const sourceCurrency = fiat?.currency;
    const convertedFiat = convertFiatStrictToDisplayCurrency({
      currencyMap,
      sourceCurrency,
      targetCurrency: displayCurrency.id,
      value: fiat?.fiatValue,
    });
    const fiatValue = convertedFiat.value;

    if (fiatValue === null) {
      hasNullTopFiat = true;
    } else {
      totalFiat = totalFiat.plus(fiatValue);
    }

    return {
      balance: fiat?.balanceParsed ?? '0',
      change24h: fiat?.price24h ?? null,
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

  return {
    account,
    currency: displayCurrency.id,
    currencySymbol: displayCurrency.symbol,
    tokenCount: tokens.length,
    tokens: payloadTokens,
    totalFiat: hasNullTopFiat ? null : totalFiat.toFixed(),
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
