import BigNumber from 'bignumber.js';

import appCrypto from '../appCrypto';
import { OneKeyLocalError } from '../errors';

import bufferUtils from './bufferUtils';
import {
  type IPortfolioTokenIconName,
  getPortfolioTokenCanonicalName,
  normalizePortfolioTokenContractAddress,
  resolvePortfolioTokenIconName,
} from './portfolioTokenIcon';
import {
  formatPro2PortfolioBalance,
  formatPro2PortfolioFiat,
  formatPro2PortfolioTotalFiat,
} from './pro2PortfolioAmountUtils';
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
  totalFiatCurrency: string;
  totalTokenCount: number;
  timestamp: number;
  tokenMap: Record<string, ITokenFiat>;
  tokens: IAccountToken[];
};

export type ISelectPortfolioPayloadTokensParams = Pick<
  IBuildPortfolioPayloadParams,
  | 'aggregateTokenMap'
  | 'currencyMap'
  | 'displayCurrency'
  | 'tokenMap'
  | 'tokens'
>;

type IConvertFiatStrictResult = {
  value: string | null;
  reason?: 'invalid-value' | 'missing-rate';
};

const PORTFOLIO_NATIVE_TOKEN_CONTRACT_NETWORK_IMPLS = new Set(['aptos', 'sui']);
const PORTFOLIO_TOKEN_LIMIT = 5;
// Firmware uses char symbol[16], reserving one byte for the trailing null.
const PORTFOLIO_TOKEN_SYMBOL_MAX_BYTES = 15;
// Token symbols must not carry contact details, URLs, or advertising copy.
const PORTFOLIO_ADVERTISING_SYMBOL_PATTERN = /[\s@]|:\/\/|www\./iu;
const PORTFOLIO_PERCENTAGE_DECIMAL_PLACES = 2;
const PORTFOLIO_DISPLAY_AMOUNT_MAX_BYTES = 47;
const PORTFOLIO_DISPLAY_AMOUNT_MAX_SIGNIFICANT_DIGITS = 7;
const PORTFOLIO_FIRMWARE_FONT_RANGES = [
  [0x00_20, 0x00_7e],
  [0x00_a0, 0x02_4f],
  [0x1e_00, 0x1e_ff],
  [0x20_00, 0x20_6f],
  [0x20_80, 0x20_89],
] as const;
const PORTFOLIO_FIRMWARE_EXTRA_GLYPHS = new Set(
  Array.from('€₩₹₽₺₫฿₱₦₴₪₿₸₡₲₵₭₮₼₾₨৳៛؋'),
);

function toPortfolioAllocationValue(value: BigNumber.Value): BigNumber {
  const valueBn = new BigNumber(value);
  if (!valueBn.isFinite() || valueBn.isNegative()) {
    return new BigNumber(0);
  }
  return valueBn;
}

function isPortfolioFirmwareFontSupported(value: string): boolean {
  return Array.from(value).every((character) => {
    const codePoint = character.codePointAt(0);
    return (
      PORTFOLIO_FIRMWARE_EXTRA_GLYPHS.has(character) ||
      PORTFOLIO_FIRMWARE_FONT_RANGES.some(
        ([start, end]) =>
          codePoint !== undefined && codePoint >= start && codePoint <= end,
      )
    );
  });
}

function truncatePortfolioTokenSymbol(value: string): string {
  let bytesLength = 0;
  let result = '';

  for (const character of value) {
    const characterBytesLength = Buffer.byteLength(character, 'utf8');
    if (bytesLength + characterBytesLength > PORTFOLIO_TOKEN_SYMBOL_MAX_BYTES) {
      break;
    }
    result += character;
    bytesLength += characterBytesLength;
  }

  return result;
}

function isPortfolioTokenSymbolEligible(value: string): boolean {
  return value.length > 0 && !PORTFOLIO_ADVERTISING_SYMBOL_PATTERN.test(value);
}

function shouldExcludePortfolioTokenByValue(
  fiat: ITokenFiat | undefined,
): boolean {
  const price = new BigNumber(fiat?.price ?? NaN);
  const fiatValue = new BigNumber(fiat?.fiatValue ?? NaN);
  return (
    (price.isFinite() && !price.isGreaterThan(0)) ||
    (fiatValue.isFinite() && !fiatValue.isGreaterThan(0))
  );
}

function buildPortfolioTokenCandidates({
  aggregateTokenMap,
  currencyMap,
  displayCurrency,
  tokenMap,
  tokens,
}: ISelectPortfolioPayloadTokensParams) {
  return tokens
    .flatMap((token) => {
      const sourceSymbol = token.commonSymbol || token.symbol;
      if (!isPortfolioTokenSymbolEligible(sourceSymbol)) {
        return [];
      }

      const fiat = getTokenFiat({ aggregateTokenMap, token, tokenMap });
      if (shouldExcludePortfolioTokenByValue(fiat)) {
        return [];
      }
      const convertedFiat = convertFiatStrictToDisplayCurrency({
        currencyMap,
        sourceCurrency: fiat?.currency,
        targetCurrency: displayCurrency.id,
        value: fiat?.fiatValue,
      });
      const allocationValue = toPortfolioAllocationValue(
        convertedFiat.value ?? 0,
      );
      if (!allocationValue.isGreaterThan(0)) {
        return [];
      }

      return [{ allocationValue, fiat, sourceSymbol, token }];
    })
    .slice(0, PORTFOLIO_TOKEN_LIMIT);
}

export function selectPortfolioPayloadTokens(
  params: ISelectPortfolioPayloadTokensParams,
): IAccountToken[] {
  return buildPortfolioTokenCandidates(params).map(({ token }) => token);
}

function getPortfolioCurrencyPrefix({
  id,
  symbol,
}: IPortfolioDisplayCurrency): string {
  const normalizedSymbol = symbol.trim();
  if (normalizedSymbol && isPortfolioFirmwareFontSupported(normalizedSymbol)) {
    return /^[a-z]{1,6}$/iu.test(normalizedSymbol)
      ? `${normalizedSymbol.toUpperCase()} `
      : normalizedSymbol;
  }

  const currencyCode = id.trim().toUpperCase();
  if (!currencyCode || !isPortfolioFirmwareFontSupported(currencyCode)) {
    throw new OneKeyLocalError(`Unsupported Portfolio display currency: ${id}`);
  }
  return `${currencyCode} `;
}

function validatePortfolioDisplayBytes(value: string, field: string): string {
  const bytesLength = Buffer.byteLength(value, 'utf8');
  if (!value || bytesLength > PORTFOLIO_DISPLAY_AMOUNT_MAX_BYTES) {
    throw new OneKeyLocalError(
      `Portfolio ${field} must be 1-${PORTFOLIO_DISPLAY_AMOUNT_MAX_BYTES} UTF-8 bytes, received ${bytesLength}`,
    );
  }
  return value;
}

function validatePortfolioDisplayAmount(value: string, field: string): string {
  validatePortfolioDisplayBytes(value, field);
  const significantDigits = value
    .replace(/[^0-9]/gu, '')
    .replace(/^0+/u, '').length;
  if (significantDigits > PORTFOLIO_DISPLAY_AMOUNT_MAX_SIGNIFICANT_DIGITS) {
    throw new OneKeyLocalError(
      `Portfolio ${field} must contain at most ${PORTFOLIO_DISPLAY_AMOUNT_MAX_SIGNIFICANT_DIGITS} significant digits, received ${significantDigits}`,
    );
  }
  return value;
}

function formatPortfolioFiat(
  value: BigNumber.Value,
  currencyPrefix: string,
  field: string,
): string {
  return validatePortfolioDisplayAmount(
    formatPro2PortfolioFiat(value, currencyPrefix),
    field,
  );
}

function formatPortfolioBalance(value: BigNumber.Value, field: string): string {
  return validatePortfolioDisplayAmount(
    formatPro2PortfolioBalance(value),
    field,
  );
}

function formatPortfolioTotalFiat(
  value: BigNumber.Value,
  currencyPrefix: string,
): string {
  return validatePortfolioDisplayBytes(
    formatPro2PortfolioTotalFiat(value, currencyPrefix),
    'totalFiat',
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
  totalFiatCurrency,
  totalTokenCount,
  timestamp,
  tokenMap,
  tokens,
}: IBuildPortfolioPayloadParams): IPortfolioPayload {
  const currencyPrefix = getPortfolioCurrencyPrefix(displayCurrency);

  const topTokenCandidates = buildPortfolioTokenCandidates({
    aggregateTokenMap,
    currencyMap,
    displayCurrency,
    tokenMap,
    tokens,
  });

  const tokenBuildResults = topTokenCandidates.map((candidate, index) => {
    const { allocationValue, fiat, sourceSymbol, token } = candidate;
    const isAllNetworks = Boolean(token.isAggregateToken);
    const isNative = isAllNetworks ? false : Boolean(token.isNative);
    const networkId = isAllNetworks ? '' : (token.networkId ?? '');
    const symbol = truncatePortfolioTokenSymbol(sourceSymbol);
    const contractAddress = getPortfolioTokenContractAddress({
      isAllNetworks,
      isNative,
      networkId,
      tokenAddress: token.address,
    });
    const iconName = resolvePortfolioTokenIconName({
      contractAddress,
      isAllNetworks,
      isNative,
      networkId,
      symbol: sourceSymbol,
    });

    return {
      allocationValue,
      payload: {
        balance: formatPortfolioBalance(
          fiat?.balanceParsed ?? '0',
          `tokens[${index}].balance`,
        ),
        contractAddress,
        fiatValue: formatPortfolioFiat(
          allocationValue,
          currencyPrefix,
          `tokens[${index}].fiatValue`,
        ),
        iconName,
        isAllNetworks,
        isNative,
        name: iconName ? getPortfolioTokenCanonicalName(iconName) : token.name,
        networkId,
        portfolioPercentage: 0,
        symbol,
      },
    };
  });

  if (!totalFiatCurrency) {
    throw new OneKeyLocalError('Portfolio total source currency is required');
  }
  const convertedTotalFiat = convertFiatStrictToDisplayCurrency({
    currencyMap,
    sourceCurrency: totalFiatCurrency,
    targetCurrency: displayCurrency.id,
    value: rawTotalFiat,
  });
  if (convertedTotalFiat.value === null) {
    throw new OneKeyLocalError(
      `Unable to convert Portfolio total from ${totalFiatCurrency} to ${displayCurrency.id}: ${
        convertedTotalFiat.reason ?? 'unknown'
      }`,
    );
  }
  const totalFiatValue = toPortfolioAllocationValue(convertedTotalFiat.value);
  const totalFiat = formatPortfolioTotalFiat(totalFiatValue, currencyPrefix);
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
      count: Math.max(
        Math.trunc(totalTokenCount) - payloadTokens.length,
        0,
      ),
      fiat: formatPortfolioFiat(
        otherTokensFiatValue,
        currencyPrefix,
        'otherTokens.fiat',
      ),
      portfolioPercentage: percentages[payloadTokens.length] ?? 0,
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
