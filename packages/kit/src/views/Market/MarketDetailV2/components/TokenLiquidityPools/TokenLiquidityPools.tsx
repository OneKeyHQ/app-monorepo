import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { SizeTokens } from '@onekeyhq/components';
import {
  Dialog,
  Divider,
  Icon,
  Image,
  InteractiveIcon,
  NumberSizeableText,
  ScrollView,
  SizableText,
  Skeleton,
  Tooltip,
  XStack,
  YStack,
  useClipboard,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { openExplorerAddressUrl } from '@onekeyhq/kit/src/utils/explorerUtils';
import { MarketTestIDs } from '@onekeyhq/kit/src/views/Market/testIDs';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import {
  NUMBER_FORMATTER,
  formatDisplayNumber,
} from '@onekeyhq/shared/src/utils/numberUtils';
import type {
  IMarketTokenTopLiquidityItem,
  IMarketTokenTopLiquidityResponse,
} from '@onekeyhq/shared/types/marketV2';

import { useTokenDetail } from '../../hooks/useTokenDetail';

import { formatDisplayPairName } from './utils';

type IFieldPath = string | readonly string[];

type IFeeFieldCandidate = {
  path: IFieldPath;
  unit?: 'basisPoint' | 'percent' | 'ratio';
};

type IDisplayPoolToken = {
  key: string;
  symbol: string;
  amount: string;
};

type IDisplayPool = {
  key: string;
  pairName: string;
  fullPairName: string;
  dexName: string;
  dexLogoUrl?: string;
  liquidity: string;
  feeRate: string;
  tokenAmounts: IDisplayPoolToken[];
  poolAddress?: string;
  creatorAddress?: string;
  networkId: string;
};

type IPoolIdentityTextSize = '$bodyLg' | '$bodyMd' | '$bodySm';

type ITokenLiquidityPoolsProps = {
  px?: string;
  pl?: string;
  pr?: string;
  pt?: string;
  pb?: string;
  showTitle?: boolean;
  variant?: 'desktop' | 'mobile';
};

type ITokenLiquidityPoolsResult = {
  requestKey: string;
  data: IMarketTokenTopLiquidityResponse;
};

type ILiquidityPoolLabels = {
  pool: string;
  tokenAmount: string;
  feeRate: string;
  poolAddress: string;
  creator: string;
};

const FALLBACK_VALUE = '--';
const ADDRESS_ACTION_GAP = '$1.5';
const ADDRESS_ACTION_ICON_SIZE = '$4';
const DESKTOP_CONTENT_MIN_WIDTH = 960;
const MIN_DISPLAY_PERCENTAGE_TEXT = '< 0.01%';
const TOKEN_AMOUNT_COMPACT_THRESHOLD = 1000;
const POOL_DETAIL_TOKEN_LIST_SCROLL_THRESHOLD = 6;
const POOL_DETAIL_TOKEN_LIST_MAX_HEIGHT = '$64';
const POOL_DETAIL_PAIR_NAME_COMPACT_THRESHOLD = 10;
const POOL_DETAIL_PAIR_NAME_MINI_THRESHOLD = 100;
const POOL_NAME_TOOLTIP_TEXT_STYLE = {
  wordBreak: 'break-all',
  whiteSpace: 'normal',
} as const;
const DESKTOP_HEADER_TEXT_PROPS = {
  size: '$bodySmMedium',
  color: '$textSubdued',
} as const;
const MOBILE_HEADER_TEXT_PROPS = {
  size: '$bodySm',
  color: '$textSubdued',
} as const;

const PAIR_NAME_CANDIDATES: readonly IFieldPath[] = [
  'pool',
  'pairName',
  'poolName',
  'name',
  'symbol',
  'pair',
];

const BASE_SYMBOL_CANDIDATES: readonly IFieldPath[] = [
  ['baseToken', 'symbol'],
  ['token0', 'symbol'],
  'baseTokenSymbol',
  'token0Symbol',
  'baseSymbol',
];

const QUOTE_SYMBOL_CANDIDATES: readonly IFieldPath[] = [
  ['quoteToken', 'symbol'],
  ['token1', 'symbol'],
  'quoteTokenSymbol',
  'token1Symbol',
  'quoteSymbol',
];

const DEX_NAME_CANDIDATES: readonly IFieldPath[] = [
  'dexName',
  'protocolName',
  ['dex', 'name'],
  ['protocol', 'name'],
  'protocol',
  'exchangeName',
];

const DEX_LOGO_CANDIDATES: readonly IFieldPath[] = [
  'protocolLogoUri',
  'dexLogoUri',
  'dexLogoUrl',
  'protocolLogoUrl',
  ['dex', 'logoUrl'],
  ['dex', 'logo'],
  ['protocol', 'logoUrl'],
  ['protocol', 'logo'],
  'logoUrl',
];

const LIQUIDITY_CANDIDATES: readonly IFieldPath[] = [
  'liquidityUsd',
  'liquidityUSD',
  'liquidity',
  'reserveInUsd',
  'reserveUSD',
  'tvl',
  'valueUsd',
  'valueUSD',
];

const FEE_CANDIDATES: readonly IFeeFieldCandidate[] = [
  { path: 'liquidityProviderFeePercent', unit: 'percent' },
  { path: 'liquidityProviderFeeRate', unit: 'ratio' },
  { path: 'taxRate', unit: 'ratio' },
  { path: 'taxPercent', unit: 'percent' },
  { path: 'lpFeeRate', unit: 'ratio' },
  { path: 'feeRate', unit: 'ratio' },
  { path: 'lpFeePercent', unit: 'percent' },
  { path: 'feePercent', unit: 'percent' },
  { path: 'lpFeeBps', unit: 'basisPoint' },
  { path: 'feeBps', unit: 'basisPoint' },
  { path: 'lpFee', unit: 'ratio' },
  { path: 'fee', unit: 'ratio' },
];

const POOL_ADDRESS_CANDIDATES: readonly IFieldPath[] = [
  'pairAddress',
  'poolAddress',
  'poolContractAddress',
  'contractAddress',
  'address',
];

const CREATOR_ADDRESS_CANDIDATES: readonly IFieldPath[] = [
  'poolCreator',
  'creatorAddress',
  'creator',
  'deployerAddress',
  'deployer',
  'ownerAddress',
  'owner',
];

const TOKEN_LIST_CANDIDATES: readonly IFieldPath[] = [
  'liquidityAmount',
  'tokens',
  'poolTokens',
  'tokenAmounts',
  'reserves',
  'assets',
];

const TOKEN_SYMBOL_FIELDS = [
  'symbol',
  'tokenSymbol',
  'baseSymbol',
  'name',
] as const;

const TOKEN_AMOUNT_FIELDS = [
  'amount',
  'tokenAmount',
  'balance',
  'reserve',
  'reserveAmount',
  'quantity',
  'liquidity',
] as const;

const TOKEN_FIELD_GROUPS = [
  {
    objectPaths: [['baseToken'], ['token0']],
    symbolPaths: ['baseTokenSymbol', 'token0Symbol', 'baseSymbol'],
    amountPaths: [
      'baseTokenAmount',
      'token0Amount',
      'baseAmount',
      'reserve0',
      'baseReserve',
      'token0Reserve',
    ],
  },
  {
    objectPaths: [['quoteToken'], ['token1']],
    symbolPaths: ['quoteTokenSymbol', 'token1Symbol', 'quoteSymbol'],
    amountPaths: [
      'quoteTokenAmount',
      'token1Amount',
      'quoteAmount',
      'reserve1',
      'quoteReserve',
      'token1Reserve',
    ],
  },
] as const;

const MOBILE_COLUMN_STYLE = {
  pool: { flex: 1, flexBasis: 0, minWidth: 0, overflow: 'hidden' },
  liquidity: { flex: 1, flexBasis: 0, minWidth: 0 },
  feeRate: { flex: 1, flexBasis: 0, minWidth: 0 },
} as const;

function useLiquidityPoolsLayoutDesktop() {
  const styles = {
    pool: {
      width: '16%',
      minWidth: 0,
      overflow: 'hidden' as const,
    },
    liquidity: {
      width: '15%',
      minWidth: 0,
    },
    tokenAmount: {
      width: '17%',
      minWidth: 0,
    },
    feeRate: {
      width: '10%',
      minWidth: 0,
    },
    poolAddress: {
      width: '21%',
      minWidth: 0,
    },
    creator: {
      width: '21%',
      minWidth: 0,
    },
  };

  return { styles };
}

function useLiquidityPoolLabels(): ILiquidityPoolLabels {
  const intl = useIntl();

  return useMemo(() => {
    return {
      pool: intl.formatMessage({ id: ETranslations.dexmarket_pool }),
      tokenAmount: intl.formatMessage({
        id: ETranslations.dexmarket_token_amount,
      }),
      feeRate: intl.formatMessage({ id: ETranslations.dexmarket_tax_rate }),
      poolAddress: intl.formatMessage({
        id: ETranslations.dexmarket_pool_address,
      }),
      creator: intl.formatMessage({ id: ETranslations.dexmarket_creator }),
    };
  }, [intl]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getValue(record: Record<string, unknown>, path: IFieldPath) {
  if (typeof path === 'string') {
    return record[path];
  }

  return path.reduce<unknown>((currentValue, pathItem) => {
    if (!isRecord(currentValue)) {
      return undefined;
    }
    return currentValue[pathItem];
  }, record);
}

function getFirstValue(
  record: Record<string, unknown>,
  candidates: readonly IFieldPath[],
) {
  for (const candidate of candidates) {
    const value = getValue(record, candidate);
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return undefined;
}

function normalizeText(value: unknown) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

function getText(
  item: IMarketTokenTopLiquidityItem,
  candidates: readonly IFieldPath[],
) {
  return normalizeText(
    getFirstValue(item as Record<string, unknown>, candidates),
  );
}

function getPositiveBigNumber(value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return undefined;
  }

  const rawValue =
    typeof value === 'number'
      ? String(value)
      : value.trim().replace(/[$,%\s,]/g, '');
  if (!rawValue) {
    return undefined;
  }

  const numberValue = new BigNumber(rawValue);
  if (!numberValue.isFinite() || numberValue.lte(0)) {
    return undefined;
  }
  return numberValue;
}

function getTokenAmountValue(value: unknown) {
  const numberValue = getPositiveBigNumber(value);
  if (!numberValue) {
    return FALLBACK_VALUE;
  }

  return numberValue.toFixed();
}

function formatUsdValue(value: unknown) {
  const numberValue = getPositiveBigNumber(value);
  if (!numberValue) {
    return FALLBACK_VALUE;
  }

  const formatted = formatDisplayNumber(
    NUMBER_FORMATTER.marketCap(numberValue.toFixed(), { currency: '$' }),
  );
  return typeof formatted === 'string' ? formatted : FALLBACK_VALUE;
}

function formatLiquidity(item: IMarketTokenTopLiquidityItem) {
  const record = item as Record<string, unknown>;
  for (const candidate of LIQUIDITY_CANDIDATES) {
    const formatted = formatUsdValue(getValue(record, candidate));
    if (formatted !== FALLBACK_VALUE) {
      return formatted;
    }
  }
  return FALLBACK_VALUE;
}

function stripTrailingZeros(value: string) {
  return value.replace(/(\.[0-9]*[1-9])0+$|\.0+$/, '$1');
}

function formatPercentageValue(
  value: unknown,
  unit: IFeeFieldCandidate['unit'] = 'ratio',
) {
  const numberValue = getPositiveBigNumber(value);
  if (!numberValue) {
    return FALLBACK_VALUE;
  }

  let percentValue = numberValue;
  const resolvedUnit =
    typeof value === 'string' && value.includes('%') ? 'percent' : unit;
  if (resolvedUnit === 'basisPoint') {
    percentValue = numberValue.div(100);
  } else if (resolvedUnit === 'ratio' && numberValue.lte(1)) {
    percentValue = numberValue.times(100);
  }

  if (!percentValue.isFinite() || percentValue.lte(0) || percentValue.gt(100)) {
    return FALLBACK_VALUE;
  }

  if (percentValue.lt(0.01)) {
    return MIN_DISPLAY_PERCENTAGE_TEXT;
  }

  const decimalPlaces = percentValue.lt(1) ? 4 : 2;
  return `${stripTrailingZeros(percentValue.toFixed(decimalPlaces))}%`;
}

function formatFeeRate(item: IMarketTokenTopLiquidityItem) {
  const record = item as Record<string, unknown>;
  for (const candidate of FEE_CANDIDATES) {
    const value = getValue(record, candidate.path);
    if (value !== undefined && value !== null && value !== '') {
      const formatted = formatPercentageValue(value, candidate.unit);
      if (formatted !== FALLBACK_VALUE) {
        return formatted;
      }
    }
  }
  return FALLBACK_VALUE;
}

function getFullPairName(item: IMarketTokenTopLiquidityItem) {
  const pairName = getText(item, PAIR_NAME_CANDIDATES);
  if (pairName) {
    return pairName;
  }

  const baseSymbol = getText(item, BASE_SYMBOL_CANDIDATES);
  const quoteSymbol = getText(item, QUOTE_SYMBOL_CANDIDATES);
  if (baseSymbol && quoteSymbol) {
    return `${baseSymbol}/${quoteSymbol}`;
  }

  return FALLBACK_VALUE;
}

function getValidAddress(
  item: IMarketTokenTopLiquidityItem,
  candidates: readonly IFieldPath[],
) {
  const address = getText(item, candidates);
  if (!address || address === '0' || address.length <= 4) {
    return undefined;
  }
  return address;
}

function getTokenFromRecord(
  tokenRecord: Record<string, unknown>,
  fallbackKey: string,
): IDisplayPoolToken | undefined {
  const symbol = normalizeText(getFirstValue(tokenRecord, TOKEN_SYMBOL_FIELDS));
  const rawAmount = getFirstValue(tokenRecord, TOKEN_AMOUNT_FIELDS);
  const amount = getTokenAmountValue(rawAmount);

  if (!symbol && amount === FALLBACK_VALUE) {
    return undefined;
  }

  return {
    key: `${fallbackKey}:${symbol ?? amount}`,
    symbol: symbol ?? FALLBACK_VALUE,
    amount,
  };
}

function getTokenFromFieldGroup(
  record: Record<string, unknown>,
  groupIndex: number,
) {
  const group = TOKEN_FIELD_GROUPS[groupIndex];
  for (const objectPath of group.objectPaths) {
    const value = getValue(record, objectPath);
    if (isRecord(value)) {
      const token = getTokenFromRecord(value, `object:${groupIndex}`);
      if (token) {
        return token;
      }
    }
  }

  const symbol = normalizeText(getFirstValue(record, group.symbolPaths));
  const rawAmount = getFirstValue(record, group.amountPaths);
  const amount = getTokenAmountValue(rawAmount);

  if (!symbol && amount === FALLBACK_VALUE) {
    return undefined;
  }

  return {
    key: `fields:${groupIndex}:${symbol ?? amount}`,
    symbol: symbol ?? FALLBACK_VALUE,
    amount,
  };
}

function getTokenAmounts(item: IMarketTokenTopLiquidityItem) {
  const record = item as Record<string, unknown>;
  const tokenListValue = getFirstValue(record, TOKEN_LIST_CANDIDATES);
  if (Array.isArray(tokenListValue)) {
    const tokens = tokenListValue
      .map((token, index) =>
        isRecord(token)
          ? getTokenFromRecord(token, `list:${index}`)
          : undefined,
      )
      .filter(Boolean);
    if (tokens.length) {
      return tokens;
    }
  }

  return TOKEN_FIELD_GROUPS.map((_, index) =>
    getTokenFromFieldGroup(record, index),
  ).filter(Boolean);
}

function toDisplayPool(
  item: IMarketTokenTopLiquidityItem,
  index: number,
  fallbackNetworkId: string,
): IDisplayPool {
  const poolAddress = getValidAddress(item, POOL_ADDRESS_CANDIDATES);
  const creatorAddress = getValidAddress(item, CREATOR_ADDRESS_CANDIDATES);
  const networkId = item.networkId || fallbackNetworkId;
  const fullPairName = getFullPairName(item);
  return {
    key: poolAddress ?? `${networkId}:${index}`,
    pairName:
      fullPairName === FALLBACK_VALUE
        ? FALLBACK_VALUE
        : formatDisplayPairName(fullPairName),
    fullPairName,
    dexName: getText(item, DEX_NAME_CANDIDATES) ?? FALLBACK_VALUE,
    dexLogoUrl: getText(item, DEX_LOGO_CANDIDATES),
    liquidity: formatLiquidity(item),
    feeRate: formatFeeRate(item),
    tokenAmounts: getTokenAmounts(item),
    poolAddress,
    creatorAddress,
    networkId,
  };
}

function PoolLogo({ uri, size = '$5' }: { uri?: string; size?: SizeTokens }) {
  if (!uri) {
    return null;
  }

  return (
    <Image
      size={size}
      borderRadius="$full"
      source={{ uri }}
      fallback={
        <Image.Fallback>
          <YStack
            w={size}
            h={size}
            borderRadius="$full"
            bg="$bgDisabled"
            ai="center"
            jc="center"
          >
            <Icon size="$3.5" color="$iconSubdued" name="SwitchHorOutline" />
          </YStack>
        </Image.Fallback>
      }
    />
  );
}

function PoolIdentity({
  item,
  logoSize = '$5',
  textSize = '$bodyLg',
  nameNumberOfLines = 1,
  truncateName = true,
}: {
  item: IDisplayPool;
  logoSize?: SizeTokens;
  textSize?: IPoolIdentityTextSize;
  nameNumberOfLines?: number;
  truncateName?: boolean;
}) {
  const { gtMd } = useMedia();
  let displayPairName = item.fullPairName;
  if (truncateName || item.fullPairName === FALLBACK_VALUE) {
    displayPairName = item.pairName;
  }

  let displayTextSize: IPoolIdentityTextSize = textSize;
  if (
    !truncateName &&
    displayPairName.length > POOL_DETAIL_PAIR_NAME_MINI_THRESHOLD
  ) {
    displayTextSize = '$bodySm';
  } else if (
    !truncateName &&
    displayPairName.length > POOL_DETAIL_PAIR_NAME_COMPACT_THRESHOLD
  ) {
    displayTextSize = '$bodyMd';
  }

  let identityOverflow: 'hidden' | 'visible' = 'visible';
  let pairNameNumberOfLines: number | undefined;
  let pairNameEllipsizeMode: 'tail' | undefined;
  let pairNameOverflow: 'hidden' | undefined;
  if (truncateName) {
    identityOverflow = 'hidden';
    pairNameNumberOfLines = nameNumberOfLines;
    pairNameEllipsizeMode = 'tail';
    pairNameOverflow = 'hidden';
  }

  const shouldShowPairNameTooltip =
    gtMd && truncateName && item.fullPairName !== FALLBACK_VALUE;
  const pairNameText = (
    <SizableText
      size={displayTextSize}
      color="$text"
      display="block"
      width="100%"
      maxWidth="100%"
      numberOfLines={pairNameNumberOfLines}
      ellipsizeMode={pairNameEllipsizeMode}
      overflow={pairNameOverflow}
      flexShrink={1}
    >
      {displayPairName}
    </SizableText>
  );
  let pairNameNode = pairNameText;
  if (shouldShowPairNameTooltip) {
    pairNameNode = (
      <Tooltip
        placement="top"
        renderContent={
          <SizableText
            size="$bodySm"
            color="$text"
            display="block"
            maxWidth="$72"
            style={POOL_NAME_TOOLTIP_TEXT_STYLE}
          >
            {item.fullPairName}
          </SizableText>
        }
        renderTrigger={pairNameText}
      />
    );
  }

  return (
    <XStack
      ai="center"
      gap="$3"
      width="100%"
      minWidth={0}
      overflow={identityOverflow}
    >
      <PoolLogo uri={item.dexLogoUrl} size={logoSize} />
      <YStack flex={1} minWidth={0} maxWidth="100%" overflow={identityOverflow}>
        {pairNameNode}
        <SizableText
          size="$bodyMd"
          color="$textSubdued"
          display="block"
          width="100%"
          maxWidth="100%"
          numberOfLines={1}
          ellipsizeMode="tail"
          overflow="hidden"
        >
          {item.dexName}
        </SizableText>
      </YStack>
    </XStack>
  );
}

function AddressActions({
  address,
  networkId,
  textAlign = 'left',
}: {
  address?: string;
  networkId: string;
  textAlign?: 'left' | 'right';
}) {
  const { copyText } = useClipboard();

  const handleCopy = useCallback(() => {
    if (address) {
      copyText(address);
    }
  }, [address, copyText]);

  const handleOpenAddress = useCallback(() => {
    if (!address) {
      return;
    }
    void openExplorerAddressUrl({
      networkId,
      address,
      openInExternal: true,
    });
  }, [address, networkId]);

  if (!address) {
    return (
      <SizableText size="$bodyMd" color="$text" textAlign={textAlign}>
        {FALLBACK_VALUE}
      </SizableText>
    );
  }

  return (
    <XStack
      ai="center"
      jc={textAlign === 'right' ? 'flex-end' : 'flex-start'}
      gap={ADDRESS_ACTION_GAP}
      minWidth={0}
    >
      <SizableText
        fontFamily="$monoRegular"
        size="$bodyMd"
        color="$text"
        numberOfLines={1}
        flexShrink={1}
      >
        {accountUtils.shortenAddress({
          address,
          leadingLength: 6,
          trailingLength: 4,
        })}
      </SizableText>
      <XStack gap={ADDRESS_ACTION_GAP} flexShrink={0}>
        <InteractiveIcon
          testID={MarketTestIDs.liquidityPoolCopyAddressBtn}
          icon="Copy3Outline"
          onPress={handleCopy}
          size={ADDRESS_ACTION_ICON_SIZE}
        />
        <InteractiveIcon
          testID={MarketTestIDs.liquidityPoolOpenAddressBtn}
          icon="OpenOutline"
          onPress={handleOpenAddress}
          size={ADDRESS_ACTION_ICON_SIZE}
        />
      </XStack>
    </XStack>
  );
}

function TokenAmountLines({ tokens }: { tokens: IDisplayPoolToken[] }) {
  if (!tokens.length) {
    return (
      <SizableText size="$bodyMd" color="$text">
        {FALLBACK_VALUE}
      </SizableText>
    );
  }

  return (
    <YStack>
      {tokens.slice(0, 2).map((token) =>
        token.amount === FALLBACK_VALUE ? (
          <SizableText
            key={token.key}
            size="$bodyMd"
            color="$text"
            numberOfLines={1}
          >
            {FALLBACK_VALUE}
          </SizableText>
        ) : (
          <XStack key={token.key} ai="center" gap="$1" minWidth={0}>
            <NumberSizeableText
              size="$bodyMd"
              color="$text"
              autoFormatter="balance-marketCap"
              autoFormatterThreshold={TOKEN_AMOUNT_COMPACT_THRESHOLD}
              numberOfLines={1}
              ellipsizeMode="tail"
              flexShrink={1}
            >
              {token.amount}
            </NumberSizeableText>
            <SizableText
              size="$bodyMd"
              color="$textSubdued"
              numberOfLines={1}
              flexShrink={1}
            >
              {token.symbol}
            </SizableText>
          </XStack>
        ),
      )}
    </YStack>
  );
}

function TokenLiquidityPoolsDesktopHeader() {
  const intl = useIntl();
  const labels = useLiquidityPoolLabels();
  const { styles } = useLiquidityPoolsLayoutDesktop();

  return (
    <XStack
      width="100%"
      minWidth={DESKTOP_CONTENT_MIN_WIDTH}
      py="$2"
      pl="$5"
      pr="$3"
      ai="center"
      bg="$bgApp"
    >
      <SizableText {...DESKTOP_HEADER_TEXT_PROPS} {...styles.pool}>
        {labels.pool}
      </SizableText>
      <SizableText {...DESKTOP_HEADER_TEXT_PROPS} {...styles.liquidity}>
        {intl.formatMessage({ id: ETranslations.dexmarket_liquidity })}
      </SizableText>
      <SizableText {...DESKTOP_HEADER_TEXT_PROPS} {...styles.tokenAmount}>
        {labels.tokenAmount}
      </SizableText>
      <SizableText {...DESKTOP_HEADER_TEXT_PROPS} {...styles.feeRate}>
        {labels.feeRate}
      </SizableText>
      <SizableText {...DESKTOP_HEADER_TEXT_PROPS} {...styles.poolAddress}>
        {labels.poolAddress}
      </SizableText>
      <SizableText {...DESKTOP_HEADER_TEXT_PROPS} {...styles.creator}>
        {labels.creator}
      </SizableText>
    </XStack>
  );
}

function TokenLiquidityPoolsMobileHeader() {
  const intl = useIntl();
  const labels = useLiquidityPoolLabels();

  return (
    <XStack h="$11" px="$5" py="$2" ai="center" gap="$3" bg="$bgApp">
      <SizableText {...MOBILE_HEADER_TEXT_PROPS} {...MOBILE_COLUMN_STYLE.pool}>
        {labels.pool}
      </SizableText>
      <SizableText
        {...MOBILE_HEADER_TEXT_PROPS}
        textAlign="right"
        {...MOBILE_COLUMN_STYLE.liquidity}
      >
        {intl.formatMessage({ id: ETranslations.dexmarket_liquidity })}
      </SizableText>
      <SizableText
        {...MOBILE_HEADER_TEXT_PROPS}
        textAlign="right"
        {...MOBILE_COLUMN_STYLE.feeRate}
      >
        {labels.feeRate}
      </SizableText>
    </XStack>
  );
}

function TokenLiquidityPoolsDesktop({ pools }: { pools: IDisplayPool[] }) {
  const { styles } = useLiquidityPoolsLayoutDesktop();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator
      width="100%"
      contentContainerStyle={{
        flexGrow: 1,
      }}
    >
      <YStack flex={1} minWidth={DESKTOP_CONTENT_MIN_WIDTH}>
        <TokenLiquidityPoolsDesktopHeader />

        {pools.map((item, index) => (
          <XStack
            key={item.key}
            minHeight="$18"
            pl="$5"
            pr="$3"
            py="$2"
            ai="center"
            hoverStyle={{ bg: '$bgHover' }}
            {...(index % 2 === 1 && { bg: '$bgSubdued' })}
          >
            <YStack {...styles.pool}>
              <PoolIdentity item={item} textSize="$bodyMd" />
            </YStack>
            <SizableText size="$bodyMd" color="$text" {...styles.liquidity}>
              {item.liquidity}
            </SizableText>
            <YStack {...styles.tokenAmount}>
              <TokenAmountLines tokens={item.tokenAmounts} />
            </YStack>
            <SizableText size="$bodyMd" color="$text" {...styles.feeRate}>
              {item.feeRate}
            </SizableText>
            <YStack {...styles.poolAddress}>
              <AddressActions
                address={item.poolAddress}
                networkId={item.networkId}
              />
            </YStack>
            <YStack {...styles.creator}>
              <AddressActions
                address={item.creatorAddress}
                networkId={item.networkId}
              />
            </YStack>
          </XStack>
        ))}
      </YStack>
    </ScrollView>
  );
}

function DetailTokenRows({ tokens }: { tokens: IDisplayPoolToken[] }) {
  const detailTokens = tokens.length
    ? tokens
    : [
        {
          key: 'empty',
          symbol: FALLBACK_VALUE,
          amount: FALLBACK_VALUE,
        },
      ];

  return (
    <YStack gap="$4">
      {detailTokens.map((token) => (
        <XStack key={token.key} ai="flex-start" jc="space-between" gap="$4">
          <SizableText
            size="$bodyLg"
            color="$textSubdued"
            flex={1}
            numberOfLines={1}
          >
            {token.symbol}
          </SizableText>
          <YStack ai="flex-end" flex={1} minWidth={0}>
            <NumberSizeableText
              size="$bodyLg"
              color="$text"
              autoFormatter="balance-marketCap"
              autoFormatterThreshold={TOKEN_AMOUNT_COMPACT_THRESHOLD}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {token.amount}
            </NumberSizeableText>
          </YStack>
        </XStack>
      ))}
    </YStack>
  );
}

function DetailInfoRow({
  label,
  value,
  address,
  networkId,
}: {
  label: string;
  value?: string;
  address?: string;
  networkId: string;
}) {
  return (
    <XStack ai="center" jc="space-between" gap="$4">
      <SizableText size="$bodyLg" color="$textSubdued">
        {label}
      </SizableText>
      {address ? (
        <AddressActions
          address={address}
          networkId={networkId}
          textAlign="right"
        />
      ) : (
        <SizableText
          size="$bodyLg"
          color="$text"
          textAlign="right"
          numberOfLines={1}
        >
          {value ?? FALLBACK_VALUE}
        </SizableText>
      )}
    </XStack>
  );
}

function PoolDetailsContent({ item }: { item: IDisplayPool }) {
  const intl = useIntl();
  const labels = useLiquidityPoolLabels();
  const shouldScrollTokenRows =
    item.tokenAmounts.length > POOL_DETAIL_TOKEN_LIST_SCROLL_THRESHOLD;
  const tokenRows = <DetailTokenRows tokens={item.tokenAmounts} />;

  return (
    <YStack pb="$5" gap="$6">
      <XStack ai="center" jc="space-between" gap="$4">
        <YStack flex={1} minWidth={0}>
          <PoolIdentity
            item={item}
            logoSize="$12"
            textSize="$bodyLg"
            truncateName={false}
          />
        </YStack>
        <SizableText
          size="$headingSm"
          color="$text"
          numberOfLines={1}
          flexShrink={0}
        >
          {item.liquidity}
        </SizableText>
      </XStack>

      <YStack gap="$4">
        <XStack ai="center" jc="space-between">
          <SizableText size="$bodyMdMedium" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.dexmarket_select_token })}
          </SizableText>
          <SizableText size="$bodyMdMedium" color="$textSubdued">
            {labels.tokenAmount}
          </SizableText>
        </XStack>
        {shouldScrollTokenRows ? (
          <ScrollView
            maxHeight={POOL_DETAIL_TOKEN_LIST_MAX_HEIGHT}
            nestedScrollEnabled
          >
            {tokenRows}
          </ScrollView>
        ) : (
          tokenRows
        )}
      </YStack>

      <Divider />

      <YStack gap="$4">
        <DetailInfoRow
          label={labels.feeRate}
          value={item.feeRate}
          networkId={item.networkId}
        />
        <DetailInfoRow
          label={labels.poolAddress}
          address={item.poolAddress}
          networkId={item.networkId}
        />
        <DetailInfoRow
          label={labels.creator}
          address={item.creatorAddress}
          networkId={item.networkId}
        />
      </YStack>
    </YStack>
  );
}

function MobilePoolRow({ item }: { item: IDisplayPool }) {
  const intl = useIntl();

  const handlePress = useCallback(() => {
    Dialog.show({
      title: intl.formatMessage({ id: ETranslations.dexmarket_pool_details }),
      renderContent: <PoolDetailsContent item={item} />,
      showFooter: false,
    });
  }, [intl, item]);

  return (
    <XStack
      minHeight="$16"
      px="$5"
      py="$3"
      ai="center"
      gap="$3"
      onPress={handlePress}
      pressStyle={{ bg: '$bgActive' }}
      hoverStyle={{ bg: '$bgHover' }}
    >
      <YStack {...MOBILE_COLUMN_STYLE.pool}>
        <PoolIdentity item={item} textSize="$bodyMd" />
      </YStack>
      <SizableText
        size="$bodyMd"
        color="$text"
        textAlign="right"
        numberOfLines={1}
        {...MOBILE_COLUMN_STYLE.liquidity}
      >
        {item.liquidity}
      </SizableText>
      <XStack
        ai="center"
        jc="flex-end"
        gap="$1"
        {...MOBILE_COLUMN_STYLE.feeRate}
      >
        <SizableText
          size="$bodyMd"
          color="$text"
          textAlign="right"
          numberOfLines={1}
        >
          {item.feeRate}
        </SizableText>
        <Icon name="ChevronRightSmallOutline" color="$iconSubdued" size="$5" />
      </XStack>
    </XStack>
  );
}

function TokenLiquidityPoolsMobile({ pools }: { pools: IDisplayPool[] }) {
  return (
    <YStack>
      <TokenLiquidityPoolsMobileHeader />
      {pools.map((item) => (
        <MobilePoolRow key={item.key} item={item} />
      ))}
    </YStack>
  );
}

function TokenLiquidityPoolsSkeleton({
  variant,
}: {
  variant: 'desktop' | 'mobile';
}) {
  if (variant === 'mobile') {
    return (
      <YStack px="$5" pt="$3" gap="$4">
        {[0, 1].map((item) => (
          <XStack key={item} ai="center" jc="space-between">
            <YStack gap="$2">
              <Skeleton height="$5" width="$24" />
              <Skeleton height="$4" width="$20" />
            </YStack>
            <Skeleton height="$5" width="$16" />
          </XStack>
        ))}
      </YStack>
    );
  }

  return (
    <YStack px="$5" pt="$3" gap="$4">
      {[0, 1].map((item) => (
        <XStack key={item} ai="center" jc="space-between" gap="$4">
          <Skeleton height="$5" width="$32" />
          <Skeleton height="$5" width="$20" />
          <Skeleton height="$5" width="$28" />
          <Skeleton height="$5" width="$16" />
          <Skeleton height="$5" width="$24" />
          <Skeleton height="$5" width="$24" />
        </XStack>
      ))}
    </YStack>
  );
}

function EmptyPools() {
  const intl = useIntl();
  return (
    <YStack minHeight="$40" ai="center" jc="center" p="$8">
      <SizableText size="$bodyLg" color="$textSubdued">
        {intl.formatMessage({ id: ETranslations.dexmarket_details_nodata })}
      </SizableText>
    </YStack>
  );
}

export function TokenLiquidityPools({
  px = '$0',
  pl,
  pr,
  pt = '$0',
  pb = '$4',
  showTitle = true,
  variant = 'desktop',
}: ITokenLiquidityPoolsProps) {
  const intl = useIntl();
  const {
    tokenAddress,
    networkId,
    tokenDetail,
    isLoading: isTokenLoading,
  } = useTokenDetail();
  const requestTokenAddress = tokenDetail?.address || tokenAddress;
  const requestKey = useMemo(
    () => `${networkId ?? ''}:${requestTokenAddress ?? ''}`,
    [networkId, requestTokenAddress],
  );

  const { result, isLoading } = usePromiseResult(
    async (): Promise<ITokenLiquidityPoolsResult> => {
      if (!requestTokenAddress || !networkId) {
        return { requestKey, data: { list: [] } };
      }
      const data =
        await backgroundApiProxy.serviceMarketV2.fetchMarketTokenTopLiquidity({
          tokenAddress: requestTokenAddress,
          networkId,
        });
      return {
        requestKey,
        data,
      };
    },
    [requestKey, requestTokenAddress, networkId],
    {
      watchLoading: true,
      undefinedResultIfError: true,
    },
  );

  const currentResult = useMemo(() => {
    if (result?.requestKey !== requestKey) {
      return undefined;
    }
    return result.data;
  }, [requestKey, result]);

  const hasStaleResult =
    result !== undefined && result.requestKey !== requestKey;
  const pools = useMemo(
    () =>
      (currentResult?.list ?? []).map((item, index) =>
        toDisplayPool(item, index, networkId),
      ),
    [currentResult?.list, networkId],
  );

  const showLoading =
    (isTokenLoading && !tokenDetail) ||
    hasStaleResult ||
    (isLoading && currentResult === undefined);

  const content = useMemo(() => {
    if (showLoading) {
      return <TokenLiquidityPoolsSkeleton variant={variant} />;
    }
    if (pools.length) {
      return variant === 'mobile' ? (
        <TokenLiquidityPoolsMobile pools={pools} />
      ) : (
        <TokenLiquidityPoolsDesktop pools={pools} />
      );
    }
    return <EmptyPools />;
  }, [pools, showLoading, variant]);

  return (
    <YStack pl={pl ?? px} pr={pr ?? px} pt={pt} pb={pb}>
      {showTitle ? (
        <SizableText size="$headingXs" color="$text" px="$5" pb="$3">
          {intl.formatMessage({
            id: ETranslations.dexmarket_pool,
          })}
        </SizableText>
      ) : null}
      {content}
    </YStack>
  );
}
