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
  useMedia,
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
  ILoanRouterNetwork,
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

// A cost, however small; what float sums leave around zero is nothing
export const isLoanLoss = (value?: number) =>
  value !== undefined && value < -1e-9;

// "≈ -$0.02 a year", "-< $0.01 a year": the value formatter writes anything
// under a cent, a cost too, as "< $0.01", so the sign goes in front here
export const formatLoanYearly = (value: number, currency: string) => {
  const amount = formatLoanFiat(Math.abs(value), currency);
  const sign = isLoanLoss(value) ? '-' : '';
  return Math.abs(value) < 0.01
    ? `${sign}${amount} ${EARN_DESKTOP_DEMO_COPY.aYear}`
    : `≈ ${sign}${amount} ${EARN_DESKTOP_DEMO_COPY.aYear}`;
};

// "-$0.04", "-< $0.01": what a plan makes a year where no rate holds
export const formatLoanNet = (value: number, currency: string) => {
  const amount = formatLoanFiat(Math.abs(value), currency);
  return isLoanLoss(value) ? `-${amount}` : amount;
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
// The rows' height, and the least of it kept where the modal leaves less room
const LIST_MAX_HEIGHT = 360;
const LIST_MIN_HEIGHT = 160;
// Between a popover list and the modal's bottom edge
const LIST_MODAL_GAP = 12;

// Where a token is offered, side by side
const NETWORKS_SHOWN = 3;
function NetworkLogos({ networks }: { networks: ILoanRouterNetwork[] }) {
  const shown = networks.slice(0, NETWORKS_SHOWN);
  return (
    <XStack ai="center" gap="$1" flexShrink={0}>
      {shown.map((network) => (
        <Token key={network.id} size="xs" tokenImageUri={network.logoURI} />
      ))}
      {networks.length > NETWORKS_SHOWN ? (
        <SizableText size="$bodySm" color="$textSubdued">
          {`+${networks.length - NETWORKS_SHOWN}`}
        </SizableText>
      ) : null}
    </XStack>
  );
}

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
  // A popover list ends inside the modal it opens from: the rows give up
  // what would hang past the modal's bottom edge
  const { gtMd } = useMedia();
  const [listMaxHeight, setListMaxHeight] = useState(LIST_MAX_HEIGHT);
  useEffect(() => {
    if (!isOpen || !gtMd || platformEnv.isNative) {
      setListMaxHeight(LIST_MAX_HEIGHT);
      return;
    }
    let frame = 0;
    let tries = 0;
    const fit = () => {
      const list = listRef.current as HTMLElement | null;
      const modals = list?.ownerDocument.querySelectorAll(
        '[data-testid="APP-Modal-Screen"]',
      );
      const modal = modals?.[modals.length - 1];
      if (!list || !modal) {
        return;
      }
      // The panel's placed box: the open animation scales what is inside it,
      // so its top and unscaled height give where the list will end
      let placed: HTMLElement = list;
      for (
        let element = list.parentElement;
        element && element !== modal.ownerDocument.body;
        element = element.parentElement
      ) {
        const { position } = getComputedStyle(element);
        if (position === 'absolute' || position === 'fixed') {
          placed = element;
          break;
        }
      }
      const { top } = placed.getBoundingClientRect();
      // Not placed yet: the popover takes its place a frame or two late
      if (top <= 0 && tries < 10) {
        tries += 1;
        frame = requestAnimationFrame(fit);
        return;
      }
      const overflow =
        top +
        placed.offsetHeight -
        (modal.getBoundingClientRect().bottom - LIST_MODAL_GAP);
      if (overflow > 0) {
        setListMaxHeight((height) =>
          Math.max(LIST_MIN_HEIGHT, Math.floor(height - overflow)),
        );
      }
    };
    frame = requestAnimationFrame(fit);
    return () => cancelAnimationFrame(frame);
  }, [gtMd, isOpen]);
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
      <ScrollView maxHeight={listMaxHeight} contentContainerStyle={{ gap: 2 }}>
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
              <NetworkLogos networks={option.networks} />
              {/* The check's place is kept, so the networks line up */}
              {isSelected ? (
                <Icon name="CheckLargeOutline" size="$4" color="$iconSuccess" />
              ) : (
                <Stack w="$4" h="$4" flexShrink={0} />
              )}
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
  isLoanLoss(value) ? '$textCritical' : undefined;

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
  isWaiting,
}: {
  isSelected: boolean;
  isBlocked: boolean;
  isWaiting: boolean;
}) {
  if (isBlocked) {
    return <Stack w={CHECK_SIZE} h={CHECK_SIZE} flexShrink={0} />;
  }
  if (isWaiting) {
    return (
      <Stack
        w={CHECK_SIZE}
        h={CHECK_SIZE}
        ai="center"
        jc="center"
        flexShrink={0}
      >
        <Skeleton w="$5" h="$5" borderRadius="$full" />
      </Stack>
    );
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
  isLoading,
}: {
  label: string;
  value: string;
  color?: IColorTokens;
  isLoading?: boolean;
}) {
  return (
    <YStack flex={1} minWidth={0} gap="$0.5">
      <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
        {label}
      </SizableText>
      {isLoading ? (
        <Stack h="$5" jc="center">
          <Skeleton w="$12" h="$3" />
        </Stack>
      ) : (
        <SizableText size="$bodyMd" color={color} numberOfLines={1}>
          {value}
        </SizableText>
      )}
    </YStack>
  );
}

function RouteRow({
  item,
  isSelected,
  isSettled,
  currency,
  onSelect,
}: {
  item: ILoanRouteItem;
  isSelected: boolean;
  isSettled: boolean;
  currency: string;
  onSelect: (key: string) => void;
}) {
  const intl = useIntl();
  const { route, metrics } = item;
  const { block } = metrics;
  const isBlocked = Boolean(block);
  const toneText = useLoanToneColors().text;
  const select = () => onSelect(route.key);
  // Until every market's figures are in, nothing can be picked: one that
  // looks open may turn out not to lend the token
  const pressProps =
    isBlocked || !isSettled
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
      // Nothing to pick where the market doesn't lend the token at all, and
      // nothing picked while the figures load
      bg={
        isSelected && isSettled && !isLendingClosed(block)
          ? '$bgActive'
          : '$bgSubdued'
      }
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
        <RouteCheck
          isSelected={isSelected}
          isBlocked={isBlocked}
          isWaiting={!isSettled}
        />
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
          // The market's own figures on their way
          isLoading={!item.facts}
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
  isSettled,
  currency,
  emptyText,
  onSelect,
}: {
  items: ILoanRouteItem[];
  selectedKey?: string;
  isLoading: boolean;
  // Every market's figures are in
  isSettled: boolean;
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
          isSettled={isSettled}
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
