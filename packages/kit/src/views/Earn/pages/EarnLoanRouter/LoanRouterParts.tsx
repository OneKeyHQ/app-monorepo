import { useEffect, useMemo, useRef, useState } from 'react';

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
  claimEscapePress,
} from '@onekeyhq/components';
import type { IColorTokens, IElement } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';

import { ProtocolImage } from '../../../Staking/components/ProtocolDisplayShared';
import { EARN_DESKTOP_DEMO_COPY } from '../../components/desktopHome/earnDesktopHomeCopy';
import { buildKeyboardPressProps } from '../../components/desktopHome/earnDesktopPressable';

import { useLoanToneColors } from './loanToneColors';

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

// "73.00", "76.61": every LTV on the page to two places, as the details page
// writes a market's
export const formatLoanLtvNumber = (fraction: number) =>
  new BigNumber(fraction * 100).toFixed(2);
export const formatLoanLtv = (fraction: number) =>
  `${formatLoanLtvNumber(fraction)}%`;

// The market doesn't lend the token to the account at all: no limit applies
export const isLendingClosed = (block?: ILoanRouteBlock) =>
  block?.kind === 'account' || block?.kind === 'borrowable';

export const formatLoanFiat = (value: number, currency: string) =>
  numberFormat(String(value), {
    formatter: 'value',
    formatterOptions: { currency },
  });

// "≈ -$0.02 a year", "< $0.01 a year": the value formatter writes anything
// under a cent, a cost too, as "< $0.01", so the sign goes in front here
export const formatLoanYearly = (value: number, currency: string) => {
  const amount = formatLoanFiat(Math.abs(value), currency);
  return Math.abs(value) < 0.01
    ? `${amount} ${EARN_DESKTOP_DEMO_COPY.aYear}`
    : `≈ ${value < 0 ? '-' : ''}${amount} ${EARN_DESKTOP_DEMO_COPY.aYear}`;
};

// "-$0.04", "< $0.01": what a plan makes a year where no rate holds
export const formatLoanNet = (value: number, currency: string) => {
  const amount = formatLoanFiat(Math.abs(value), currency);
  return value <= -0.01 ? `-${amount}` : amount;
};

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
  isOpen = true,
  closePopover,
}: {
  testID: string;
  options: ILoanRouterOption[];
  selectedSymbol: string;
  onSelect: (symbol: string) => void;
  // On narrow windows the list is a sheet, mounted while closed too
  isOpen?: boolean;
  closePopover: () => void;
}) {
  const intl = useIntl();
  const [search, setSearch] = useState('');
  const listRef = useRef<IElement>(null);
  // Closed, the list forgets its search and its field lets go of the focus,
  // so typing and Escape reach the modal again
  useEffect(() => {
    if (isOpen) {
      return;
    }
    setSearch('');
    if (platformEnv.isNative) {
      return;
    }
    const focused = globalThis.document?.activeElement;
    if (
      focused instanceof HTMLElement &&
      (listRef.current as HTMLElement | null)?.contains(focused)
    ) {
      focused.blur();
    }
  }, [isOpen]);
  const shown = useMemo(() => {
    const query = search.trim().toUpperCase();
    return query
      ? options.filter((option) => option.symbol.toUpperCase().includes(query))
      : options;
  }, [options, search]);
  return (
    <YStack ref={listRef} testID={testID} p="$2" gap="$1">
      {options.length > SEARCH_FROM ? (
        <Stack px="$1" pb="$1">
          <SearchBar
            // Only while the list shows: a closed sheet's field mustn't take
            // the focus when the modal opens
            autoFocus={isOpen}
            placeholder={intl.formatMessage({
              id: ETranslations.global_search,
            })}
            value={search}
            onChangeText={setSearch}
            onKeyPress={(event) => {
              if (event.nativeEvent.key === 'Escape' && isOpen) {
                // The field keeps the press from the popover: the list
                // closes, the modal under it stays
                claimEscapePress();
                closePopover();
              }
            }}
          />
        </Stack>
      ) : null}
      <ScrollView maxHeight={360} contentContainerStyle={{ gap: 2 }}>
        {shown.length ? null : (
          <SizableText
            testID={`${testID}-empty`}
            size="$bodyMd"
            color="$textSubdued"
            px="$3"
            py="$2"
          >
            {intl.formatMessage({ id: ETranslations.global_no_results })}
          </SizableText>
        )}
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

// Under the market's name, past its logo
const FIGURES_INDENT = '$12';
const CHECK_SIZE = '$6';
// A card with its figures, for the skeletons while the markets load
export const LOAN_ROUTE_CARD_HEIGHT = 112;

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

// A figure the table had a column for, its name over it; every card has the
// same three, so they line up from card to card
function RouteFigure({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: IColorTokens;
}) {
  return (
    <YStack flex={1} minWidth={0} gap="$0.5">
      <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
        {label}
      </SizableText>
      <SizableText size="$bodyMd" color={color} numberOfLines={1}>
        {value}
      </SizableText>
    </YStack>
  );
}

function RouteRow({
  item,
  isSelected,
  currency,
  onSelect,
}: {
  item: ILoanRouteItem;
  isSelected: boolean;
  currency: string;
  onSelect: (key: string) => void;
}) {
  const intl = useIntl();
  const { route, metrics } = item;
  const { block } = metrics;
  const isBlocked = Boolean(block);
  const toneText = useLoanToneColors().text;
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
  // Where the plan's Net APY doesn't hold (the market's position carries
  // part of the loan), what it makes or costs a year
  const yearly = metrics.netApy === undefined ? metrics.annualNet : undefined;
  return (
    <YStack
      testID={`earn-loan-route-${route.key}`}
      gap="$3"
      px="$4"
      py="$3.5"
      // Nothing to pick where the market doesn't lend the token at all
      bg={isSelected && !isLendingClosed(block) ? '$bgActive' : '$bgSubdued'}
      borderRadius="$3"
      borderCurve="continuous"
      userSelect="none"
      {...pressProps}
    >
      <XStack ai="center" gap="$3">
        <MarketCell route={route} />
        {/* What the plan makes here, named under it */}
        <YStack ai="flex-end" flexShrink={0} gap="$0.5">
          <SizableText
            size="$bodyLgMedium"
            color={textColor ?? netApyColor(yearly ?? metrics.netApy)}
            numberOfLines={1}
          >
            {yearly !== undefined
              ? formatLoanNet(yearly, currency)
              : formatLoanPercent(metrics.netApy)}
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
            {yearly !== undefined
              ? EARN_DESKTOP_DEMO_COPY.aYear
              : intl.formatMessage({ id: ETranslations.defi_net_apy })}
          </SizableText>
        </YStack>
        <RouteCheck isSelected={isSelected} isBlocked={isBlocked} />
      </XStack>
      <XStack pl={FIGURES_INDENT} pr="$9" gap="$3">
        <RouteFigure
          label={intl.formatMessage({ id: ETranslations.defi_supply_apy })}
          value={formatLoanPercent(route.collateral.supplyApy)}
          color={textColor}
        />
        <RouteFigure
          label={intl.formatMessage({ id: ETranslations.defi_borrow_apy })}
          value={formatLoanPercent(route.borrow.borrowApy)}
          color={textColor}
        />
        {/* The limit the form and the reasons go by */}
        <RouteFigure
          label={intl.formatMessage({ id: ETranslations.defi_max_ltv })}
          value={
            metrics.maxLtv !== undefined && !isLendingClosed(block)
              ? formatLoanLtv(metrics.maxLtv)
              : '–'
          }
          color={textColor}
        />
      </XStack>
      {/* Why the market can't take the loan, the market's liquidity among
          the reasons */}
      {block ? (
        <SizableText
          size="$bodySm"
          style={{ color: toneText.caution }}
          pl={FIGURES_INDENT}
          testID={`earn-loan-route-block-${route.key}`}
        >
          {getLoanBlockText({ block, route, currency })}
        </SizableText>
      ) : null}
    </YStack>
  );
}

/**
 * Every market for the pair, as the deposit modal lists its protocols: each
 * a card, the one picked lighter with a check. Those that can't take the
 * loan come last, with why, and can't be picked
 */
export function LoanRouteList({
  items,
  selectedKey,
  isLoading,
  currency,
  emptyText,
  onSelect,
}: {
  items: ILoanRouteItem[];
  selectedKey?: string;
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
            h={LOAN_ROUTE_CARD_HEIGHT}
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
      {items.map((item) => (
        <RouteRow
          key={item.route.key}
          item={item}
          isSelected={item.route.key === selectedKey}
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
    <XStack gap="$2" ai="center">
      <XStack>
        <Token size="sm" tokenImageUri={collateral.logoURI} />
        <Stack
          ml="$-2"
          borderRadius="$full"
          borderWidth={2}
          borderColor="$bgApp"
        >
          <Token size="sm" tokenImageUri={borrow.logoURI} />
        </Stack>
      </XStack>
      <SizableText size="$headingLg" numberOfLines={1} flexShrink={1}>
        {`${collateral.symbol} / ${borrow.symbol}`}
      </SizableText>
    </XStack>
  );
}
