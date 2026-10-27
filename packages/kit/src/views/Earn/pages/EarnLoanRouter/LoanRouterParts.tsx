import { useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Icon,
  ScrollView,
  SearchBar,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IColorTokens } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';

import { ProtocolImage } from '../../../Staking/components/ProtocolDisplayShared';
import { EARN_DESKTOP_DEMO_COPY } from '../../components/desktopHome/earnDesktopHomeCopy';
import { buildKeyboardPressProps } from '../../components/desktopHome/earnDesktopPressable';

import type {
  ILoanRoute,
  ILoanRouteBlock,
  ILoanRouteFacts,
  ILoanRouteMetrics,
  ILoanRouterOption,
} from './loanRouter.utils';

export const formatLoanPercent = (value?: number) =>
  value === undefined || !Number.isFinite(value)
    ? '–'
    : `${new BigNumber(value).toFixed(2)}%`;

// "73%", "80.5%": a market's limit as it's written
export const formatLoanLtv = (fraction: number) =>
  `${new BigNumber(fraction * 100).decimalPlaces(2).toFixed()}%`;

export const formatLoanFiat = (value: number, currency: string) =>
  numberFormat(String(value), {
    formatter: 'value',
    formatterOptions: { currency },
  });

const formatCompactFiat = (value: number, currency: string) =>
  numberFormat(String(value), {
    formatter: 'marketCap',
    formatterOptions: { currency },
  });

export function getLoanBlockText({
  block,
  route,
  currency,
}: {
  block: ILoanRouteBlock;
  route: ILoanRoute;
  currency: string;
}) {
  switch (block.kind) {
    case 'account':
      return EARN_DESKTOP_DEMO_COPY.loanNoAccount(route.market.network.name);
    case 'borrowable':
      return EARN_DESKTOP_DEMO_COPY.loanNotLent(
        route.borrow.symbol,
        block.eModeLabel,
      );
    case 'liquidity':
      return EARN_DESKTOP_DEMO_COPY.loanLiquidity(
        formatCompactFiat(block.liquidity, currency),
      );
    case 'maxLtv':
      return EARN_DESKTOP_DEMO_COPY.loanMaxLtv(formatLoanLtv(block.maxLtv));
    default:
      return '';
  }
}

// ---------- The token lists of the two boxes ----------

// Past this many tokens the list gets a search field
const SEARCH_FROM = 8;

/**
 * A box's token list, in the chip's popover as the lending repay form lists
 * its collaterals: the token's logo and symbol, the one in the box lighter
 */
export function LoanTokenList({
  testID,
  options,
  selectedSymbol,
  onSelect,
  closePopover,
}: {
  testID: string;
  options: ILoanRouterOption[];
  selectedSymbol: string;
  onSelect: (symbol: string) => void;
  closePopover: () => void;
}) {
  const intl = useIntl();
  const [search, setSearch] = useState('');
  const shown = useMemo(() => {
    const query = search.trim().toUpperCase();
    return query
      ? options.filter((option) => option.symbol.toUpperCase().includes(query))
      : options;
  }, [options, search]);
  return (
    <YStack testID={testID} p="$2" gap="$1">
      {options.length > SEARCH_FROM ? (
        <Stack px="$1" pb="$1">
          <SearchBar
            autoFocus
            placeholder={intl.formatMessage({
              id: ETranslations.global_search,
            })}
            value={search}
            onChangeText={setSearch}
          />
        </Stack>
      ) : null}
      <ScrollView maxHeight={360} contentContainerStyle={{ gap: 2 }}>
        {shown.map((option) => {
          const isSelected =
            option.symbol.toUpperCase() === selectedSymbol.toUpperCase();
          const select = () => {
            if (!isSelected) {
              onSelect(option.symbol);
            }
            closePopover();
          };
          return (
            <XStack
              key={option.symbol}
              testID={`${testID}-${option.symbol}`}
              role="option"
              aria-selected={isSelected}
              py="$2"
              px="$3"
              gap="$2.5"
              ai="center"
              borderRadius="$2"
              bg={isSelected ? '$bgHover' : undefined}
              hoverStyle={isSelected ? undefined : { bg: '$bgHover' }}
              pressStyle={{ bg: '$bgActive' }}
              cursor="pointer"
              userSelect="none"
              onPress={select}
              {...buildKeyboardPressProps(select, 2)}
            >
              <Token size="sm" tokenImageUri={option.logoURI} />
              <SizableText size="$bodyMdMedium" flex={1} numberOfLines={1}>
                {option.symbol}
              </SizableText>
              {isSelected ? (
                <Icon name="CheckLargeOutline" size="$4" color="$iconSuccess" />
              ) : null}
            </XStack>
          );
        })}
      </ScrollView>
    </YStack>
  );
}

// ---------- The markets ----------

export type ILoanRouteItem = {
  route: ILoanRoute;
  facts?: ILoanRouteFacts;
  metrics: ILoanRouteMetrics;
};

// The table's columns, header and rows alike: the figures keep their width,
// the market's name gives way
const COLUMNS = {
  market: { flex: 1, minWidth: 0 },
  netApy: { w: 76, flexShrink: 0, ai: 'flex-end' },
  supply: { w: 76, flexShrink: 0, ai: 'flex-end' },
  borrow: { w: 76, flexShrink: 0, ai: 'flex-end' },
  available: { w: 76, flexShrink: 0, ai: 'flex-end' },
  maxLtv: { w: 60, flexShrink: 0, ai: 'flex-end' },
} as const;
const COLUMN_GAP = '$3';
// Under the market's name, past its logo
const REASON_INDENT = '$12';
const CHECK_SIZE = '$6';
export const LOAN_ROUTE_ROW_HEIGHT = 68;

function HeaderLabel({ children }: { children: string }) {
  return (
    <SizableText size="$bodySmMedium" color="$textSubdued" numberOfLines={1}>
      {children}
    </SizableText>
  );
}

const netApyColor = (value?: number): IColorTokens | undefined =>
  value !== undefined && value < 0 ? '$textCritical' : undefined;

function MarketCell({ route }: { route: ILoanRoute }) {
  return (
    <XStack ai="center" gap="$3" minWidth={0} flex={1}>
      <ProtocolImage
        logoURI={route.market.logoURI}
        networkLogoURI={route.market.network.logoURI}
      />
      <YStack flex={1} minWidth={0} gap="$0.5">
        <SizableText size="$bodyLgMedium" numberOfLines={1}>
          {route.marketLabel}
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
          {route.market.network.name}
        </SizableText>
      </YStack>
    </XStack>
  );
}

function RouteCheck({
  isSelected,
  isBlocked,
}: {
  isSelected: boolean;
  isBlocked: boolean;
}) {
  if (isBlocked) {
    return <Stack w={CHECK_SIZE} h={CHECK_SIZE} flexShrink={0} />;
  }
  return (
    <Icon
      name={isSelected ? 'CheckRadioSolid' : 'CirclePlaceholderOnOutline'}
      color={isSelected ? '$iconSuccess' : '$iconSubdued'}
      size={CHECK_SIZE}
      flexShrink={0}
    />
  );
}

function RouteRow({
  item,
  isSelected,
  isWide,
  currency,
  onSelect,
}: {
  item: ILoanRouteItem;
  isSelected: boolean;
  isWide: boolean;
  currency: string;
  onSelect: (key: string) => void;
}) {
  const { route, facts, metrics } = item;
  const { block } = metrics;
  const isBlocked = Boolean(block);
  const select = () => onSelect(route.key);
  const pressProps = isBlocked
    ? {}
    : {
        role: 'radio' as const,
        'aria-checked': isSelected,
        cursor: 'pointer',
        hoverStyle: isSelected ? undefined : { bg: '$bgHover' },
        pressStyle: { bg: '$bgActive' },
        onPress: select,
        ...buildKeyboardPressProps(select, 2),
      };
  const textColor = isBlocked ? '$textDisabled' : undefined;
  const netApy = (
    <SizableText
      size="$bodyLgMedium"
      color={textColor ?? netApyColor(metrics.netApy)}
      numberOfLines={1}
    >
      {formatLoanPercent(metrics.netApy)}
    </SizableText>
  );
  const figure = (text: string) => (
    <SizableText size="$bodyMd" color={textColor} numberOfLines={1}>
      {text}
    </SizableText>
  );
  return (
    <YStack
      testID={`earn-loan-route-${route.key}`}
      gap="$1.5"
      px="$4"
      py="$3"
      minHeight={LOAN_ROUTE_ROW_HEIGHT}
      jc="center"
      bg={isSelected ? '$bgActive' : '$bgSubdued'}
      borderRadius="$3"
      borderCurve="continuous"
      userSelect="none"
      {...pressProps}
    >
      <XStack ai="center" gap={COLUMN_GAP}>
        <MarketCell route={route} />
        {isWide ? (
          <>
            <YStack {...COLUMNS.netApy}>{netApy}</YStack>
            <YStack {...COLUMNS.supply}>
              {figure(formatLoanPercent(route.collateral.supplyApy))}
            </YStack>
            <YStack {...COLUMNS.borrow}>
              {figure(formatLoanPercent(route.borrow.borrowApy))}
            </YStack>
            <YStack {...COLUMNS.available}>
              {figure(
                facts?.liquidity
                  ? formatCompactFiat(facts.liquidity, currency)
                  : '–',
              )}
            </YStack>
            <YStack {...COLUMNS.maxLtv}>
              {figure(
                facts?.maxLtv !== undefined ? formatLoanLtv(facts.maxLtv) : '–',
              )}
            </YStack>
          </>
        ) : (
          <YStack ai="flex-end" flexShrink={0} gap="$0.5">
            {netApy}
            <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
              {`${formatLoanPercent(route.borrow.borrowApy)} ${route.borrow.symbol}`}
            </SizableText>
          </YStack>
        )}
        <RouteCheck isSelected={isSelected} isBlocked={isBlocked} />
      </XStack>
      {/* Why the market can't take the loan, under its name */}
      {block ? (
        <SizableText
          size="$bodySm"
          color="$textCaution"
          pl={REASON_INDENT}
          testID={`earn-loan-route-block-${route.key}`}
        >
          {getLoanBlockText({ block, route, currency })}
        </SizableText>
      ) : null}
    </YStack>
  );
}

/**
 * Every market for the pair, as the Swap page lists its routes and the
 * Loans list its rows: the one picked lighter with a check. Those that can't
 * take the loan come last, with why, and can't be picked
 */
export function LoanRouteList({
  items,
  selectedKey,
  isWide,
  isLoading,
  currency,
  emptyText,
  onSelect,
}: {
  items: ILoanRouteItem[];
  selectedKey?: string;
  isWide: boolean;
  isLoading: boolean;
  currency: string;
  emptyText: string;
  onSelect: (key: string) => void;
}) {
  const intl = useIntl();
  if (isLoading && !items.length) {
    return (
      <YStack gap="$2">
        {[0, 1, 2].map((index) => (
          <Skeleton
            key={index}
            h={LOAN_ROUTE_ROW_HEIGHT}
            w="100%"
            borderRadius="$3"
          />
        ))}
      </YStack>
    );
  }
  if (!items.length) {
    return (
      <YStack
        testID="earn-loan-routes-empty"
        py="$10"
        ai="center"
        bg="$bgSubdued"
        borderRadius="$3"
      >
        <SizableText size="$bodyLg" color="$textSubdued">
          {emptyText}
        </SizableText>
      </YStack>
    );
  }
  return (
    <YStack
      testID="earn-loan-routes"
      role="radiogroup"
      aria-label={intl.formatMessage({ id: ETranslations.global_market })}
      gap="$2"
    >
      {isWide ? (
        <XStack ai="center" gap={COLUMN_GAP} px="$4" pb="$1">
          <XStack {...COLUMNS.market}>
            <HeaderLabel>
              {intl.formatMessage({ id: ETranslations.global_market })}
            </HeaderLabel>
          </XStack>
          <YStack {...COLUMNS.netApy}>
            <HeaderLabel>
              {intl.formatMessage({ id: ETranslations.defi_net_apy })}
            </HeaderLabel>
          </YStack>
          <YStack {...COLUMNS.supply}>
            <HeaderLabel>
              {intl.formatMessage({ id: ETranslations.defi_supply_apy })}
            </HeaderLabel>
          </YStack>
          <YStack {...COLUMNS.borrow}>
            <HeaderLabel>
              {intl.formatMessage({ id: ETranslations.defi_borrow_apy })}
            </HeaderLabel>
          </YStack>
          <YStack {...COLUMNS.available}>
            <HeaderLabel>
              {intl.formatMessage({ id: ETranslations.global_available })}
            </HeaderLabel>
          </YStack>
          <YStack {...COLUMNS.maxLtv}>
            <HeaderLabel>
              {intl.formatMessage({ id: ETranslations.defi_max_ltv })}
            </HeaderLabel>
          </YStack>
          <Stack w={CHECK_SIZE} flexShrink={0} />
        </XStack>
      ) : null}
      {items.map((item) => (
        <RouteRow
          key={item.route.key}
          item={item}
          isSelected={item.route.key === selectedKey}
          isWide={isWide}
          currency={currency}
          onSelect={onSelect}
        />
      ))}
    </YStack>
  );
}

// ---------- The pair's title ----------

export function LoanPairTitle({
  collateral,
  borrow,
}: {
  collateral: { symbol: string; logoURI?: string };
  borrow: { symbol: string; logoURI?: string };
}) {
  return (
    <XStack gap="$3" ai="center">
      <XStack>
        <Token size="md" tokenImageUri={collateral.logoURI} />
        <Stack
          ml="$-2.5"
          borderRadius="$full"
          borderWidth={2}
          borderColor="$bgApp"
        >
          <Token size="md" tokenImageUri={borrow.logoURI} />
        </Stack>
      </XStack>
      <SizableText size="$headingXl" numberOfLines={1} flexShrink={1}>
        {`${collateral.symbol} / ${borrow.symbol}`}
      </SizableText>
    </XStack>
  );
}
