import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { Platform } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import {
  HeightTransition,
  Icon,
  Image,
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
import type {
  IColorTokens,
  IElement,
  IScrollViewRef,
} from '@onekeyhq/components';
import { ANIMATE_ONLY_OPACITY } from '@onekeyhq/components/src/utils/animationConstants';
import { NetworkAvatarBase } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IBorrowReserveFormTab } from '@onekeyhq/shared/src/routes';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';

import { ProtocolImage } from '../../../Staking/components/ProtocolDisplayShared';
import { ANIMATE_ONLY_BG_COLOR } from '../../components/desktopHome/earnDesktopColorEase';
import { EARN_DESKTOP_DEMO_COPY } from '../../components/desktopHome/earnDesktopHomeCopy';
import { buildKeyboardPressProps } from '../../components/desktopHome/earnDesktopPressable';
import {
  EarnHeaderPickArrow,
  EarnHeaderPickCell,
  EarnHeaderPickRow,
} from '../../components/desktopHome/EarnHeaderPick';
import { getEarnAssetClassLabel } from '../EarnAssetSelect/earnAssetClassLabel';
import { EarnAssetLogos } from '../EarnAssetSelect/EarnAssetLogos';
import { sortAssetSelectTokens } from '../EarnAssetSelect/earnAssetSelect.utils';
import { warmSwapNetworkParents } from '../EarnAssetSelect/earnAssetSelectNetworkParents';
import { OfferMark } from '../EarnRouter/EarnOfferOptionCard';

import { useLoanToneColors } from './loanToneColors';

import type {
  ILoanPayPath,
  ILoanRoute,
  ILoanRouteBlock,
  ILoanRouteFacts,
  ILoanRouteMetrics,
  ILoanRouterNetwork,
  ILoanRouterOption,
} from './loanRouter.utils';
import type {
  IEarnAssetPick,
  IEarnAssetSelectNetwork,
  IEarnAssetSelectPurpose,
  IEarnAssetSelectToken,
} from '../EarnAssetSelect/earnAssetSelect.utils';

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
      return EARN_DESKTOP_DEMO_COPY.loanMaxLtv(
        formatLoanLtv(block.maxLtv),
        block.ltv === undefined ? undefined : formatLoanLtv(block.ltv),
      );
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
  // The list opens on the token in the box, in the middle of the rows where
  // there are rows above it to scroll past
  const scrollRef = useRef<IScrollViewRef>(null);
  const selectedRowRef = useRef<{ y: number; height: number } | undefined>(
    undefined,
  );
  const viewHeightRef = useRef(0);
  const hasScrolledRef = useRef(false);
  const scrollToSelected = () => {
    const row = selectedRowRef.current;
    if (!row || !viewHeightRef.current) {
      return;
    }
    hasScrolledRef.current = true;
    scrollRef.current?.scrollTo({
      y: Math.max(0, row.y - (viewHeightRef.current - row.height) / 2),
      animated: false,
    });
  };
  useEffect(() => {
    if (!isOpen) {
      hasScrolledRef.current = false;
      return;
    }
    // A sheet mounted while closed has its rows placed already
    scrollToSelected();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);
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
      <ScrollView
        ref={scrollRef}
        maxHeight={listMaxHeight}
        contentContainerStyle={{ gap: 2 }}
        onLayout={(event) => {
          viewHeightRef.current = event.nativeEvent.layout.height;
          if (isOpen && !hasScrolledRef.current) {
            scrollToSelected();
          }
        }}
      >
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
              onLayout={
                isSelected
                  ? (event) => {
                      selectedRowRef.current = event.nativeEvent.layout;
                      if (isOpen && !hasScrolledRef.current) {
                        scrollToSelected();
                      }
                    }
                  : undefined
              }
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
  // A kind of token on a side: the card names its own pair
  pairLabel?: string;
  // Pay with doesn't pay with this collateral there: a swap buys it first,
  // or a bridge brings it from another network
  payPath?: Exclude<ILoanPayPath, 'direct'>;
  // The market can't take the plan as typed, so it can't be picked. Without
  // it, any reason the market has stops it
  isBlocked?: boolean;
};

// A reserve page of the picked market: its supplied token's or its loan's
export type ILoanReserveSide = Extract<
  IBorrowReserveFormTab,
  'supply' | 'borrow'
>;

// Under the market's name, past its logo
const FIGURES_INDENT = '$12';
// Past the pair's two logos instead, comparing a kind of token: 58 + 12
const PAIR_FIGURES_INDENT = 70;
const CHECK_SIZE = '$6';
// The line under the figures that says why a market can't take the loan,
// and the card's gap above it
const REASON_LINE_HEIGHT = 16;
const CARD_GAP = 12;
const FADE_IN = { opacity: 0 } as const;
// Cards that change places slide there, on the app's smooth curve
const SLIDE_MS = 220;
const SLIDE_EASING = 'cubic-bezier(0.2, 0, 0, 1)';
const REASON_LINE_TRANSITION = ['smooth', { duration: 200 }] as [
  'smooth',
  { duration: number },
];
// The web driver writes animateOnly keys into the CSS transition as they
// are, where only the hyphenated name works; native takes the style key
const ANIMATE_ONLY_HEIGHT_MARGIN = Platform.select({
  web: ['height', 'margin-top'],
  default: ['height', 'marginTop'],
});
const ANIMATE_ONLY_BG_OPACITY = [...ANIMATE_ONLY_BG_COLOR, 'opacity'];

type ICardPlace = { top: number; color: string };

// Where each card shows in their list (the cards' parent), a slide under way
// included, and the color it shows
const readCardPlaces = (nodes: Map<string, HTMLElement>) => {
  const places = new Map<string, ICardPlace>();
  const list = [...nodes.values()][0]?.parentElement;
  if (!list) {
    return places;
  }
  const listTop = list.getBoundingClientRect().top;
  nodes.forEach((node, key) => {
    places.set(key, {
      top: node.getBoundingClientRect().top - listTop,
      color: getComputedStyle(node).backgroundColor,
    });
  });
  return places;
};

const colorChannels = (color: string) =>
  (color.match(/[\d.]+/g) ?? []).map(Number);

// The picked card's color is see-through, and a card rising passes over the
// others: it slides in its colors laid over what is under the list, from
// the one it showed to the one it ends on, in place of its own ease
function solidSlideColors(
  node: HTMLElement,
  shownColor: string,
): [string, string] | undefined {
  let under = node.parentElement;
  while (
    under &&
    (colorChannels(getComputedStyle(under).backgroundColor)[3] ?? 1) < 1
  ) {
    under = under.parentElement;
  }
  if (!under) {
    return undefined;
  }
  const [underR, underG, underB] = colorChannels(
    getComputedStyle(under).backgroundColor,
  );
  const solid = (color: string) => {
    const [r, g, b, alpha = 1] = colorChannels(color);
    const mix = (top: number, bottom: number) =>
      Math.round(top * alpha + bottom * (1 - alpha));
    return `rgb(${mix(r, underR)}, ${mix(g, underG)}, ${mix(b, underB)})`;
  };
  const { transition } = node.style;
  node.style.transition = 'none';
  const endColor = getComputedStyle(node).backgroundColor;
  node.style.transition = transition;
  return [solid(shownColor), solid(endColor)];
}

const netApyColor = (value?: number): IColorTokens | undefined =>
  isLoanLoss(value) ? '$textCritical' : undefined;

// Comparing pairs across a kind of token, the pair leads: the collateral's
// logo and the borrowed token's, overlapped as the app's token groups are,
// the market's on them where a network's would be, as the deposit modal
// puts the protocol's on a token
function PairOnMarketImage({
  route,
  ringColor,
  hoverRingColor,
}: {
  route: ILoanRoute;
  ringColor: IColorTokens;
  hoverRingColor?: IColorTokens;
}) {
  return (
    <Stack position="relative" flexShrink={0}>
      <EarnAssetLogos
        logos={[route.collateral.logoURI ?? '', route.borrow.logoURI ?? '']}
        size="md"
        ringColor={ringColor}
        groupHoverRingColor={hoverRingColor}
      />
      {route.market.logoURI ? (
        <Stack
          position="absolute"
          bottom={-2}
          right={-2}
          p={1}
          bg="$bgApp"
          borderRadius="$1.5"
        >
          <Image
            w="$4"
            h="$4"
            borderRadius="$1"
            source={{ uri: route.market.logoURI }}
          />
        </Stack>
      ) : null}
    </Stack>
  );
}

function MarketCell({
  route,
  pairLabel,
  payPath,
  ringColor,
  hoverRingColor,
}: {
  route: ILoanRoute;
  pairLabel?: string;
  payPath?: Exclude<ILoanPayPath, 'direct'>;
  // The card's color around the pair's logos, and as it is hovered
  ringColor: IColorTokens;
  hoverRingColor?: IColorTokens;
}) {
  const intl = useIntl();
  return (
    <XStack ai="center" gap="$3" minWidth={0} flex={1}>
      {pairLabel ? (
        <PairOnMarketImage
          route={route}
          ringColor={ringColor}
          hoverRingColor={hoverRingColor}
        />
      ) : (
        // The network is a mark after the name: the logo keeps to the
        // market
        <ProtocolImage logoURI={route.market.logoURI} />
      )}
      <YStack flex={1} minWidth={0} gap="$0.5">
        {/* The market, then its network and what comes before the supply
            (a swap, a bridge) as marks, as on the Earn window's cards */}
        <XStack
          ai="center"
          columnGap="$1.5"
          rowGap="$0.5"
          minWidth={0}
          flexWrap="wrap"
        >
          <SizableText
            size="$bodyLgMedium"
            numberOfLines={1}
            flexShrink={1}
            minWidth={0}
          >
            {route.marketLabel}
          </SizableText>
          <XStack ai="center" gap="$1" flexShrink={0}>
            <OfferMark
              label={route.market.network.name}
              imageUri={route.market.network.logoURI}
            />
            {payPath ? (
              <OfferMark
                testID={`earn-loan-route-${payPath}-${route.key}`}
                label={intl.formatMessage({
                  id:
                    payPath === 'bridge'
                      ? ETranslations.swap_page_bridge
                      : ETranslations.global_swap,
                })}
                icon={
                  payPath === 'bridge' ? 'BridgeOutline' : 'SwitchHorOutline'
                }
                tone="info"
              />
            ) : null}
          </XStack>
        </XStack>
        {/* The pair is what tells a kind's cards apart */}
        {pairLabel ? (
          <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
            {pairLabel}
          </SizableText>
        ) : null}
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

// Why the market can't take the loan, under its figures, the market's
// liquidity among the reasons. Until every market's figures are in, a
// line's room is kept, so a card that turns out not to take the loan doesn't
// grow; the room of one that can closes, and a reason that comes later (an
// amount past its liquidity) opens
function RouteReasonLine({
  text,
  isReserved,
  indent,
  testID,
}: {
  text?: string;
  isReserved: boolean;
  // Under the market's name
  indent: number | '$12';
  testID: string;
}) {
  const noteColor = useLoanToneColors().note;
  const reduceMotion = useReducedMotion();
  const [textHeight, setTextHeight] = useState(REASON_LINE_HEIGHT);
  let height = 0;
  if (text) {
    height = textHeight;
  } else if (isReserved) {
    height = REASON_LINE_HEIGHT;
  }
  return (
    <YStack
      height={height}
      // Without a line, the card's gap above it goes too
      mt={height ? 0 : -CARD_GAP}
      overflow="hidden"
      transition={reduceMotion ? undefined : REASON_LINE_TRANSITION}
      animateOnly={ANIMATE_ONLY_HEIGHT_MARGIN}
    >
      {text ? (
        <YStack
          position="absolute"
          top={0}
          left={0}
          right={0}
          onLayout={(event) =>
            setTextHeight(Math.ceil(event.nativeEvent.layout.height))
          }
        >
          <SizableText
            size="$bodySm"
            style={{ color: noteColor }}
            pl={indent}
            testID={testID}
            transition={reduceMotion ? undefined : 'quick'}
            animateOnly={ANIMATE_ONLY_OPACITY}
            enterStyle={reduceMotion ? undefined : FADE_IN}
          >
            {text}
          </SizableText>
        </YStack>
      ) : null}
    </YStack>
  );
}

// A card as it shows while the markets load: the logo, name and network,
// the result, the three figures and the reason line's room, so the cards
// that come take the place it held
function RouteRowSkeleton() {
  return (
    <YStack
      gap="$3"
      px="$4"
      py="$3.5"
      bg="$bgSubdued"
      borderRadius="$3"
      borderCurve="continuous"
      aria-hidden
    >
      <XStack ai="center" gap="$3">
        <XStack ai="center" gap="$3" flex={1} minWidth={0}>
          <Skeleton w="$9" h="$9" borderRadius="$2" />
          <YStack gap="$0.5">
            <Skeleton.BodyLg w={96} />
            <Skeleton.BodySm w={56} />
          </YStack>
        </XStack>
        <YStack ai="flex-end" gap="$0.5">
          <Skeleton.BodyLg w={56} />
          <Skeleton.BodySm w={48} />
        </YStack>
        <Stack w={CHECK_SIZE} h={CHECK_SIZE} flexShrink={0} />
      </XStack>
      <XStack pl={FIGURES_INDENT} pr="$9" gap="$3">
        {[0, 1, 2].map((index) => (
          <YStack key={index} flex={1} minWidth={0} gap="$0.5">
            <Skeleton.BodySm w={56} />
            <Skeleton.BodyMd w={48} />
          </YStack>
        ))}
      </XStack>
      <Stack h={REASON_LINE_HEIGHT} />
    </YStack>
  );
}

// The picked card's links fold out under its figures as fast as its reason
// line does
const RESERVE_LINKS_MS = 200;

// A way from the picked market to one of its reserve pages, under its
// figures. It doesn't pick the card it sits in
function ReserveLink({
  testID,
  token,
  marketLabel,
  isShown,
  onPress,
}: {
  testID: string;
  token: { symbol: string; logoURI: string };
  marketLabel: string;
  // Folded away, it takes no focus
  isShown: boolean;
  onPress: () => void;
}) {
  return (
    <XStack
      testID={testID}
      role="link"
      aria-label={EARN_DESKTOP_DEMO_COPY.loanAssetOn(token.symbol, marketLabel)}
      alignSelf="flex-start"
      maxWidth="100%"
      ai="center"
      gap="$1.5"
      // The logo keeps the figures' edge; the pressed fill reaches past it
      mx="$-1.5"
      px="$1.5"
      py="$0.5"
      borderRadius="$2"
      borderCurve="continuous"
      userSelect="none"
      cursor="pointer"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      onPress={(event: { stopPropagation: () => void }) => {
        event.stopPropagation();
        onPress();
      }}
      {...buildKeyboardPressProps(isShown ? onPress : undefined, 2)}
    >
      <Token size="xs" tokenImageUri={token.logoURI} />
      {/* The card names the market: the token alone here */}
      <SizableText size="$bodyMdMedium" numberOfLines={1} flexShrink={1}>
        {token.symbol}
      </SizableText>
      <Icon
        name="ChevronRightSmallOutline"
        size="$4"
        color="$iconSubdued"
        flexShrink={0}
      />
    </XStack>
  );
}

/**
 * Beside the form, the picked market's reserve pages stand under the form's
 * button, so every market card keeps one height and a pick moves no card:
 * the market by its logo and name, then its two tokens' pages
 */
export function LoanMarketLinks({
  route,
  onOpenReserve,
}: {
  route: ILoanRoute;
  onOpenReserve: (route: ILoanRoute, side: ILoanReserveSide) => void;
}) {
  return (
    <XStack
      testID="earn-loan-market-links"
      ai="center"
      gap="$3"
      bg="$bgSubdued"
      borderRadius="$3"
      borderCurve="continuous"
      pl="$3"
      pr="$4"
      py="$3"
    >
      {route.market.logoURI ? (
        <Image
          w="$6"
          h="$6"
          borderRadius="$1.5"
          flexShrink={0}
          source={{ uri: route.market.logoURI }}
        />
      ) : null}
      <SizableText
        size="$bodyMd"
        color="$textSubdued"
        numberOfLines={1}
        flex={1}
        minWidth={0}
      >
        {route.marketLabel}
      </SizableText>
      <XStack ai="center" gap="$4" flexShrink={0}>
        <ReserveLink
          testID={`earn-loan-route-reserve-supply-${route.key}`}
          token={route.collateral}
          marketLabel={route.marketLabel}
          isShown
          onPress={() => onOpenReserve(route, 'supply')}
        />
        <ReserveLink
          testID={`earn-loan-route-reserve-borrow-${route.key}`}
          token={route.borrow}
          marketLabel={route.marketLabel}
          isShown
          onPress={() => onOpenReserve(route, 'borrow')}
        />
      </XStack>
    </XStack>
  );
}

function RouteRow({
  item,
  isSelected,
  isSettled,
  currency,
  netApyLabel,
  onSelect,
  onOpenReserve,
  nodeRef,
}: {
  item: ILoanRouteItem;
  isSelected: boolean;
  isSettled: boolean;
  currency: string;
  netApyLabel: string;
  onSelect: (key: string) => void;
  onOpenReserve?: (route: ILoanRoute, side: ILoanReserveSide) => void;
  // The card's element on web, for the list to slide it to a new place
  nodeRef: (node: unknown) => void;
}) {
  const intl = useIntl();
  const reduceMotion = useReducedMotion();
  const { route, metrics } = item;
  const { block } = metrics;
  const isBlocked = item.isBlocked ?? Boolean(block);
  const select = () => onSelect(route.key);
  // The picked card opens on the market's pages for its two tokens
  const isOpen = isSelected && isSettled;
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
  // Unlit where the market doesn't lend the token and the plan needs it to
  const isLit =
    isSelected && isSettled && !(isBlocked && isLendingClosed(block));
  const cardColor: IColorTokens = isLit ? '$bgActive' : '$bgSubdued';
  // A kind of token on a side: the pair's logos lead, the figures and the
  // reason line start under the market's name past them
  const isPair = Boolean(item.pairLabel);
  const indent = isPair ? PAIR_FIGURES_INDENT : FIGURES_INDENT;
  // The position's Net APY there after the plan; where none holds (it would
  // owe more than it holds), what the plan makes or costs a year
  const yearly = metrics.netApy === undefined ? metrics.annualNet : undefined;
  return (
    <YStack
      ref={nodeRef}
      testID={`earn-loan-route-${route.key}`}
      gap="$3"
      px="$4"
      py="$3.5"
      // Nothing to pick where the market doesn't lend the token at all, and
      // nothing picked while the figures load
      bg={cardColor}
      // The logos' rings follow its color as it is hovered
      group
      borderRadius="$3"
      borderCurve="continuous"
      userSelect="none"
      // Its color eases as it is hovered and picked; a card that comes in
      // (the markets for another token) fades in
      transition={reduceMotion ? undefined : 'quick'}
      animateOnly={ANIMATE_ONLY_BG_OPACITY}
      enterStyle={reduceMotion ? undefined : FADE_IN}
      {...pressProps}
    >
      <XStack ai="center" gap="$3">
        <MarketCell
          route={route}
          pairLabel={item.pairLabel}
          payPath={item.payPath}
          ringColor={cardColor}
          hoverRingColor={
            isSelected || isBlocked || !isSettled ? undefined : '$bgHover'
          }
        />
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
            {yearly !== undefined ? EARN_DESKTOP_DEMO_COPY.aYear : netApyLabel}
          </SizableText>
        </YStack>
        <RouteCheck
          isSelected={isSelected}
          isBlocked={isBlocked}
          isWaiting={!isSettled}
        />
      </XStack>
      <XStack pl={indent} pr="$9" gap="$3">
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
      <RouteReasonLine
        text={block ? getLoanBlockText({ block, route, currency }) : undefined}
        isReserved={!isSettled}
        indent={indent}
        testID={`earn-loan-route-block-${route.key}`}
      />
      {onOpenReserve ? (
        // Folded, the card's gap above them goes too
        <YStack mt={-CARD_GAP}>
          <HeightTransition
            hide={!isOpen}
            duration={reduceMotion ? 0 : RESERVE_LINKS_MS}
          >
            <XStack
              pt={CARD_GAP}
              pl={indent}
              columnGap="$5"
              rowGap="$1"
              flexWrap="wrap"
              aria-hidden={!isOpen}
            >
              <ReserveLink
                testID={`earn-loan-route-reserve-supply-${route.key}`}
                token={route.collateral}
                marketLabel={route.marketLabel}
                isShown={isOpen}
                onPress={() => onOpenReserve(route, 'supply')}
              />
              <ReserveLink
                testID={`earn-loan-route-reserve-borrow-${route.key}`}
                token={route.borrow}
                marketLabel={route.marketLabel}
                isShown={isOpen}
                onPress={() => onOpenReserve(route, 'borrow')}
              />
            </XStack>
          </HeightTransition>
        </YStack>
      ) : null}
    </YStack>
  );
}

/**
 * Every market for the pair, as the deposit modal lists its protocols: each
 * a card, the one picked lighter with a check. Those that can't take the
 * loan come last, with why, and can't be picked unless the plan is a supply
 * alone they take
 */
export function LoanRouteList({
  items,
  selectedKey,
  isLoading,
  isSettled,
  currency,
  emptyText,
  netApyLabel,
  onSelect,
  onOpenReserve,
}: {
  items: ILoanRouteItem[];
  selectedKey?: string;
  isLoading: boolean;
  // Every market's figures are in
  isSettled: boolean;
  currency: string;
  emptyText: string;
  // What the cards' rate is worked out for: the plan, or a reference loan
  netApyLabel: string;
  onSelect: (key: string) => void;
  onOpenReserve?: (route: ILoanRoute, side: ILoanReserveSide) => void;
}) {
  const intl = useIntl();
  const reduceMotion = useReducedMotion();
  // Cards that change places (the figures in, a drag let go, a market
  // picked) slide from where they showed to their new places. Where they
  // showed is read before the new order is drawn
  const nodesRef = useRef(new Map<string, HTMLElement>());
  const nodeRefs = useRef(new Map<string, (node: unknown) => void>());
  const slidesRef = useRef(new WeakMap<HTMLElement, Animation>());
  const orderKey = items.map((item) => item.route.key).join('|');
  const drawnOrderRef = useRef(orderKey);
  const shownPlacesRef = useRef<Map<string, ICardPlace> | undefined>(undefined);
  if (orderKey === drawnOrderRef.current) {
    shownPlacesRef.current = undefined;
  } else if (
    platformEnv.isRuntimeBrowser &&
    nodesRef.current.size &&
    !shownPlacesRef.current
  ) {
    shownPlacesRef.current = readCardPlaces(nodesRef.current);
  }
  useLayoutEffect(() => {
    const shownPlaces = shownPlacesRef.current;
    shownPlacesRef.current = undefined;
    drawnOrderRef.current = orderKey;
    if (!shownPlaces || reduceMotion) {
      return;
    }
    nodesRef.current.forEach((node) => slidesRef.current.get(node)?.cancel());
    const places = readCardPlaces(nodesRef.current);
    places.forEach(({ top }, key) => {
      const node = nodesRef.current.get(key);
      const shown = shownPlaces.get(key);
      if (!node || !shown || Math.abs(shown.top - top) < 1) {
        return;
      }
      const from = { transform: `translateY(${shown.top - top}px)` };
      const to = { transform: 'translateY(0px)' };
      // A card moving up passes over the ones it overtakes
      const colors =
        shown.top > top ? solidSlideColors(node, shown.color) : undefined;
      slidesRef.current.set(
        node,
        node.animate(
          colors
            ? [
                { ...from, zIndex: 1, backgroundColor: colors[0] },
                { ...to, zIndex: 1, backgroundColor: colors[1] },
              ]
            : [from, to],
          { duration: SLIDE_MS, easing: SLIDE_EASING },
        ),
      );
    });
  }, [orderKey, reduceMotion]);
  const getNodeRef = (key: string) => {
    let ref = nodeRefs.current.get(key);
    if (!ref) {
      ref = (node: unknown) => {
        if (typeof HTMLElement !== 'undefined' && node instanceof HTMLElement) {
          nodesRef.current.set(key, node);
        } else {
          nodesRef.current.delete(key);
        }
      };
      nodeRefs.current.set(key, ref);
    }
    return ref;
  };
  if (isLoading && !items.length) {
    return (
      <YStack gap="$2">
        {[0, 1, 2].map((index) => (
          <RouteRowSkeleton key={index} />
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
          netApyLabel={netApyLabel}
          onSelect={onSelect}
          onOpenReserve={onOpenReserve}
          nodeRef={getNodeRef(item.route.key)}
        />
      ))}
    </YStack>
  );
}

// ---------- The picks ----------

// Between the two halves, as between the amount boxes under them
const PICK_SEAM = 8;
// The arrow on the seam, in a ring of the window's color as the one between
// the amount boxes; a half's text keeps clear of it
const PICK_ARROW_SIZE = 28;
const PICK_ARROW_CLEARANCE = 20;

export type ILoanPickSide = {
  testID: string;
  // The side's role in the steps' words: "Supply", "Borrow"
  caption: string;
  pick: IEarnAssetPick;
  tokens: IEarnAssetSelectToken[];
  purpose: IEarnAssetSelectPurpose;
  // The token's logo before the list is in
  fallbackLogoURI?: string;
  onPress: () => void;
};

function LoanPickHalf({
  side,
  network,
  isTrailing,
  hasArrow,
}: {
  side: ILoanPickSide;
  // The network both picks are on; none, every network
  network?: IEarnAssetSelectNetwork;
  // The right half, past the seam
  isTrailing: boolean;
  // The arrow sits on the seam: the text keeps clear of it
  hasArrow: boolean;
}) {
  const intl = useIntl();
  const { testID, caption, pick, tokens, purpose, fallbackLogoURI, onPress } =
    side;
  const seamPadding = hasArrow ? PICK_ARROW_CLEARANCE : '$3.5';
  const kindLogos = useMemo(
    () =>
      pick.kind === 'class'
        ? sortAssetSelectTokens(
            tokens.filter((token) => token.type === pick.assetClass),
            purpose,
          ).map((token) => token.logoURI)
        : [],
    [pick, purpose, tokens],
  );
  const token =
    pick.kind === 'token'
      ? tokens.find(
          (item) => item.symbol.toUpperCase() === pick.symbol.toUpperCase(),
        )
      : undefined;
  const label =
    pick.kind === 'class'
      ? getEarnAssetClassLabel(intl, pick.assetClass)
      : (token?.symbol ?? pick.symbol);
  return (
    <YStack
      testID={testID}
      role="button"
      // The logos' rings follow its color as it is hovered
      group
      flex={1}
      flexBasis={0}
      minWidth={0}
      gap="$0.5"
      py="$2.5"
      pl={isTrailing ? seamPadding : '$3.5'}
      pr={isTrailing ? '$3.5' : seamPadding}
      bg="$bgSubdued"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      borderRadius="$3"
      borderCurve="continuous"
      userSelect="none"
      cursor="pointer"
      onPress={onPress}
      {...buildKeyboardPressProps(onPress, 2)}
    >
      {/* The side's role, then where it is, as Swap's boxes say "From" and
          the network */}
      <XStack testID={`${testID}-network`} ai="center" gap="$1.5" minWidth={0}>
        <SizableText
          size="$bodySm"
          color="$textSubdued"
          numberOfLines={1}
          flexShrink={0}
        >
          {caption}
        </SizableText>
        <XStack ai="center" gap="$1" minWidth={0} flexShrink={1}>
          <NetworkAvatarBase
            logoURI={network?.logoURI ?? ''}
            isAllNetworks={!network}
            size="$3.5"
          />
          <SizableText size="$bodySm" numberOfLines={1} flexShrink={1}>
            {network?.name ??
              intl.formatMessage({ id: ETranslations.global_all_networks })}
          </SizableText>
        </XStack>
      </XStack>
      <XStack ai="center" gap="$2" minWidth={0}>
        {pick.kind === 'class' ? (
          <EarnAssetLogos
            logos={kindLogos}
            size="xs"
            ringColor="$bgSubdued"
            groupHoverRingColor="$bgHover"
          />
        ) : (
          // The line above names the network, as Swap's boxes do: the logo
          // carries no badge of it
          <Token size="sm" tokenImageUri={token?.logoURI || fallbackLogoURI} />
        )}
        <SizableText size="$bodyLgMedium" numberOfLines={1} flexShrink={1}>
          {label}
        </SizableText>
        <Icon
          name="ChevronDownSmallOutline"
          size="$5"
          color="$iconSubdued"
          flexShrink={0}
          ml="$-1"
        />
      </XStack>
    </YStack>
  );
}

// A pick in the window's header: its role, then its token, as a field
// without its box
function LoanPickCell({ side }: { side: ILoanPickSide }) {
  const intl = useIntl();
  const { testID, caption, pick, tokens, purpose, fallbackLogoURI, onPress } =
    side;
  const kindLogos = useMemo(
    () =>
      pick.kind === 'class'
        ? sortAssetSelectTokens(
            tokens.filter((token) => token.type === pick.assetClass),
            purpose,
          ).map((token) => token.logoURI)
        : [],
    [pick, purpose, tokens],
  );
  const token =
    pick.kind === 'token'
      ? tokens.find(
          (item) => item.symbol.toUpperCase() === pick.symbol.toUpperCase(),
        )
      : undefined;
  return (
    <EarnHeaderPickCell
      testID={testID}
      label={caption}
      logo={
        pick.kind === 'class' ? (
          <EarnAssetLogos logos={kindLogos} size="xs" />
        ) : (
          <Token size="xs" tokenImageUri={token?.logoURI || fallbackLogoURI} />
        )
      }
      value={
        pick.kind === 'class'
          ? getEarnAssetClassLabel(intl, pick.assetClass)
          : (token?.symbol ?? pick.symbol)
      }
      onPress={onPress}
    />
  );
}

// The network both picks are on, in the wide window's header over the
// markets' column. Picked in either pick's list: it opens the supply side's
export function LoanPickNetwork({
  network,
  onPress,
}: {
  // None, every network
  network?: IEarnAssetSelectNetwork;
  onPress: () => void;
}) {
  const intl = useIntl();
  return (
    <EarnHeaderPickCell
      testID="earn-loan-pick-network"
      label={intl.formatMessage({ id: ETranslations.global_network })}
      logo={
        <NetworkAvatarBase
          logoURI={network?.logoURI ?? ''}
          isAllNetworks={!network}
          size="$5"
        />
      }
      value={
        network?.name ??
        intl.formatMessage({ id: ETranslations.global_all_networks })
      }
      onPress={onPress}
    />
  );
}

/**
 * The two picks heading the Loans form, as a flight search's from and to: what
 * is supplied on the left, what is borrowed on the right, an arrow on the
 * seam. Each half says its role and the network over its token and opens its
 * own list; one row at every width, a long name cut short. The two share the
 * network, a loan being one market's (11-05). At phone width the halves meet
 * without the arrow, their captions alone saying which side is which
 */
export function LoanPickBar({
  supply,
  borrow,
  network,
  inHeader,
}: {
  supply: ILoanPickSide;
  borrow: ILoanPickSide;
  // The network both picks are on; none, every network
  network?: IEarnAssetSelectNetwork;
  // As the wide window's header: each pick under its role, as the Earn
  // window's header reads. The network they share stands over the markets
  // (LoanPickNetwork)
  inHeader?: boolean;
}) {
  const { gtMd } = useMedia();
  // The selectors the halves open group their networks by Swap's list
  useEffect(warmSwapNetworkParents, []);
  if (inHeader) {
    return (
      <EarnHeaderPickRow testID="earn-loan-pick-bar">
        <LoanPickCell side={supply} />
        <EarnHeaderPickArrow />
        <LoanPickCell side={borrow} />
      </EarnHeaderPickRow>
    );
  }
  return (
    <XStack testID="earn-loan-pick-bar" gap={PICK_SEAM} position="relative">
      <LoanPickHalf
        side={supply}
        network={network}
        isTrailing={false}
        hasArrow={gtMd}
      />
      <LoanPickHalf
        side={borrow}
        network={network}
        isTrailing
        hasArrow={gtMd}
      />
      {gtMd ? (
        <Stack
          position="absolute"
          top="50%"
          left="50%"
          mt={-PICK_ARROW_SIZE / 2}
          ml={-PICK_ARROW_SIZE / 2}
          w={PICK_ARROW_SIZE}
          h={PICK_ARROW_SIZE}
          ai="center"
          jc="center"
          borderRadius="$full"
          bg="$bgApp"
          pointerEvents="none"
          aria-hidden
        >
          <Stack
            w="$6"
            h="$6"
            ai="center"
            jc="center"
            borderRadius="$full"
            bg="$bgSubdued"
          >
            <Icon name="ArrowRightOutline" size="$3.5" color="$iconSubdued" />
          </Stack>
        </Stack>
      ) : null}
    </XStack>
  );
}

// ---------- The pair's title ----------

// The done view's title: what went in, written as the picks are. A supply
// alone names its token only
export function LoanPairTitle({
  collateral,
  borrow,
}: {
  collateral: { symbol: string; logoURI?: string };
  borrow?: { symbol: string; logoURI?: string };
}) {
  const intl = useIntl();
  const side = (role: string, token: { symbol: string; logoURI?: string }) => (
    <XStack ai="center" gap="$2" minWidth={0} flexShrink={1}>
      <SizableText size="$headingLg" color="$textSubdued" flexShrink={0}>
        {role}
      </SizableText>
      <Token size="sm" tokenImageUri={token.logoURI} />
      <SizableText size="$headingLg" numberOfLines={1} flexShrink={1}>
        {token.symbol}
      </SizableText>
    </XStack>
  );
  return (
    <XStack gap="$2" ai="center" minWidth={0}>
      {side(intl.formatMessage({ id: ETranslations.defi_supply }), collateral)}
      {borrow ? (
        <>
          <Icon
            name="ArrowRightOutline"
            size="$4"
            color="$iconSubdued"
            flexShrink={0}
          />
          {side(
            intl.formatMessage({ id: ETranslations.global_borrow }),
            borrow,
          )}
        </>
      ) : null}
    </XStack>
  );
}
