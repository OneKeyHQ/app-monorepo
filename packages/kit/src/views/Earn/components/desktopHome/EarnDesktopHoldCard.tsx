import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { useReducedMotion } from 'react-native-reanimated';

import {
  Accordion,
  Badge,
  Button,
  Icon,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  getFontSize,
  useMedia,
} from '@onekeyhq/components';
import type { IElement } from '@onekeyhq/components';
import { ANIMATE_ONLY_OPACITY } from '@onekeyhq/components/src/utils/animationConstants';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar/NetworkAvatar';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { convertFiat } from '@onekeyhq/kit/src/utils/fiatConvert';
import {
  useCurrencyPersistAtom,
  useSettingsPersistAtom,
  useSettingsValuePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useWarmOffersDeposit } from '../../pages/EarnRouter/useWarmOffersDeposit';
import {
  LIST_HIDDEN_STYLE,
  getListHeightTransition,
  getListRowMotion,
} from '../../utils/earnListMotion';
import { AprText } from '../AprText';
import { EarnPhoneSectionTitle } from '../EarnPhoneSectionTitle';

import { ANIMATE_ONLY_BG_COLOR } from './earnDesktopColorEase';
import { EARN_DESKTOP_DEMO_COPY } from './earnDesktopHomeCopy';
import {
  EarnDesktopSurfaceProvider,
  SurfaceToken,
  buildKeyboardPressProps,
  usePressableSurface,
} from './earnDesktopPressable';
import { useEarnDesktopScrollPin } from './useEarnDesktopScrollPin';
import { useEarnDesktopSurfaces } from './useEarnDesktopSurfaces';

import type {
  IEarnDesktopHoldOffer,
  IEarnDesktopHoldRow,
} from './earnDesktopHome.utils';

// Five rows, then the rest open in place
const ROW_LIMIT = 5;
// The phone home's sections show four rows each
const PHONE_ROW_LIMIT = 4;
const MORE_ROWS_VALUE = 'more';
// The pointer resting this long on a row gets its deposit form's data ready;
// passing over the list doesn't
const WARM_INTENT_MS = 100;
// The rows on screen are read ahead this long after the list settles, a row
// at a time
const READ_AHEAD_DELAY_MS = 800;
const READ_AHEAD_GAP_MS = 250;
const ROW_HEIGHT = 68;
const ROW_GAP = '$3';
const ACTION_WIDTH = 72;
// The table's proportions below, so the two lists read alike
const column = (
  flex: number,
  align: 'flex-start' | 'flex-end' = 'flex-start',
  minWidth = 0,
) => ({
  flexGrow: flex,
  flexShrink: 1,
  flexBasis: 0,
  minWidth,
  ai: align,
});
const COLUMNS = {
  asset: column(3),
  network: column(1.4),
  balance: column(1.4, 'flex-end'),
  apr: column(1.4, 'flex-end', 136),
};
const stopPropagation = (event: { stopPropagation: () => void }) =>
  event.stopPropagation();
// A hidden amount is asterisks, which sit at the cap height. Lowered by this
// share of their size, as the hero lowers its own, they center on the line the
// words beside them fill
const ASTERISK_DROP = 0.16;

// The best offer's rate, colored the way the table colors it
export function OfferRate({
  offer,
  size = '$bodyLgMedium',
}: {
  offer: IEarnDesktopHoldOffer;
  size?: '$bodyLgMedium' | '$bodyMdMedium';
}) {
  if (offer.kind === 'lending') {
    return (
      <SizableText size={size}>{`${new BigNumber(offer.offer.apy).toFixed(
        2,
      )}%`}</SizableText>
    );
  }
  const { item } = offer;
  return (
    <AprText
      hideSuffix
      size={size}
      asset={{
        aprWithoutFee: item.provider.aprWithoutFee ?? '',
        aprInfo: item.aprInfo,
        rewardUnit: item.provider.rewardUnit,
      }}
    />
  );
}

// The rate shown is the best offer's, so its badge (a bonus, and why the
// rate is green) is too, as the offer cards and the Earn table show it
const getOfferBadge = (offer: IEarnDesktopHoldOffer | undefined) =>
  offer?.kind === 'protocol' ? offer.item.provider.badges?.[0] : undefined;

// A phone's width: the rate's column in every row, so the balances keep one
// edge. A badge takes a line of its own under the rate's, where the widest
// fits, leaving the symbol and the whole balance their room
const NARROW_RATE_WIDTH = 96;
// Two lines of a row (an amount at 24 over its 16 tall second line) and the
// token's icon (md)
const TWO_LINES_HEIGHT = 24 + 16;
const TOKEN_ICON_SIZE = 32;
// The rows' first lines on one line across the tiles: a row with a badge
// grows downwards. This much above and below two lines makes the tile's
// height, as centring did
const NARROW_ROW_PY = (ROW_HEIGHT - TWO_LINES_HEIGHT) / 2;
const NARROW_ICON_MT = (TWO_LINES_HEIGHT - TOKEN_ICON_SIZE) / 2;

// What the balance would earn in a year at that rate
function YearlyLine({ row }: { row: IEarnDesktopHoldRow }) {
  const [best] = row.offers;
  const [{ currencyMap }] = useCurrencyPersistAtom();
  const [{ currencyInfo }] = useSettingsPersistAtom();
  const [{ hideValue: isHidden }] = useSettingsValuePersistAtom();
  const yearlyUsd = new BigNumber(row.fiatValueUsd)
    .times(best.apr)
    .div(100)
    .toFixed();
  // Under a cent the value formatter writes "< 0.01", a bound already, so no
  // "≈" goes in front. Hidden, every line keeps it, or its absence would tell
  const yearly = new BigNumber(
    convertFiat({
      value: yearlyUsd,
      sourceCurrency: USD_CURRENCY_ID,
      targetCurrency: currencyInfo.id,
      currencyMap,
    }),
  );
  const isUnderCent = yearly.gt(0) && yearly.lt(0.01);
  return (
    <XStack ai="baseline" gap="$1">
      {isHidden || !isUnderCent ? (
        <SizableText size="$bodySm" color="$textSubdued">
          ≈
        </SizableText>
      ) : null}
      <Currency
        hideValue
        size="$bodySm"
        color="$textSubdued"
        formatter="value"
        sourceCurrency={USD_CURRENCY_ID}
        numberOfLines={1}
        y={
          isHidden
            ? Math.round(getFontSize('$bodySm') * ASTERISK_DROP)
            : undefined
        }
      >
        {yearlyUsd}
      </Currency>
      <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
        {EARN_DESKTOP_DEMO_COPY.aYear}
      </SizableText>
    </XStack>
  );
}

function RowBalance({ row }: { row: IEarnDesktopHoldRow }) {
  return (
    <>
      <NumberSizeableTextWrapper
        hideValue
        size="$bodyLgMedium"
        formatter="balance"
        numberOfLines={1}
      >
        {row.amount}
      </NumberSizeableTextWrapper>
      <Currency
        hideValue
        size="$bodySm"
        color="$textSubdued"
        formatter="value"
        sourceCurrency={USD_CURRENCY_ID}
        numberOfLines={1}
      >
        {row.fiatValueUsd}
      </Currency>
    </>
  );
}

function BasicHoldRow({
  row,
  networkName,
  isWide,
  onOpenRow,
  onWarmRow,
}: {
  row: IEarnDesktopHoldRow;
  networkName?: string;
  isWide: boolean;
  onOpenRow: (row: IEarnDesktopHoldRow) => void;
  // Gets the deposit modal's form ready, so it opens complete
  onWarmRow: (row: IEarnDesktopHoldRow) => void;
}) {
  const intl = useIntl();
  const reduceMotion = useReducedMotion();
  // Hover and press colors ease in, as the open rows of the table do
  const colorTransition = reduceMotion ? undefined : 'quick';
  const onPress = () => onOpenRow(row);
  const onWarm = useCallback(() => onWarmRow(row), [onWarmRow, row]);
  // The cards' steps: at rest a tile is the card color, never the hover or
  // open-row color the Earn table below uses
  const { surface, handlers: surfaceHandlers } = usePressableSurface(true);
  const warmTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  useEffect(() => () => clearTimeout(warmTimerRef.current), []);
  const handlers = useMemo(
    () =>
      surfaceHandlers
        ? {
            ...surfaceHandlers,
            onHoverIn: () => {
              surfaceHandlers.onHoverIn();
              clearTimeout(warmTimerRef.current);
              warmTimerRef.current = setTimeout(onWarm, WARM_INTENT_MS);
            },
            onHoverOut: () => {
              surfaceHandlers.onHoverOut();
              clearTimeout(warmTimerRef.current);
            },
            // A touch has no hover: the press itself starts it
            onPressIn: () => {
              surfaceHandlers.onPressIn();
              onWarm();
            },
          }
        : undefined,
    [onWarm, surfaceHandlers],
  );
  // A press that came without a rest on the row starts the read too
  const handleButtonPressIn = useCallback(
    (event: { stopPropagation: () => void }) => {
      stopPropagation(event);
      onWarm();
    },
    [onWarm],
  );
  const [best] = row.offers;
  const symbol = row.token.symbol;
  const badge = getOfferBadge(best);
  const badgeElement = badge ? (
    <Badge badgeType={badge.badgeType} badgeSize="sm" flexShrink={0}>
      <Badge.Text>{badge.tag}</Badge.Text>
    </Badge>
  ) : null;
  const symbolText = (
    <SizableText size="$bodyLgMedium" numberOfLines={1} flexShrink={1}>
      {symbol}
    </SizableText>
  );
  const fixedLine = best.isFixedRate ? (
    <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
      {intl.formatMessage({ id: ETranslations.defi_fixed_rate })}
    </SizableText>
  ) : null;
  return (
    <EarnDesktopSurfaceProvider value={surface}>
      <XStack
        testID={`earn-desktop-hold-${row.networkId}-${symbol}`}
        role="button"
        ai={isWide ? 'center' : 'flex-start'}
        gap={ROW_GAP}
        minHeight={ROW_HEIGHT}
        px="$4"
        py={isWide ? undefined : NARROW_ROW_PY}
        borderRadius="$3"
        borderCurve="continuous"
        bg={surface}
        transition={colorTransition}
        animateOnly={ANIMATE_ONLY_BG_COLOR}
        cursor="pointer"
        userSelect="none"
        onPress={onPress}
        // Reached by Tab, Enter comes next: as the pointer resting on it
        onFocus={onWarm}
        {...handlers}
        {...buildKeyboardPressProps(onPress)}
      >
        {isWide ? (
          <>
            <XStack {...COLUMNS.asset} ai="center" gap="$3">
              {/* The chain on the token too, as every token row under the
                  hero shows it */}
              <SurfaceToken
                size="md"
                tokenImageUri={row.token.logoURI || row.asset.logoURI}
                networkId={row.networkId}
              />
              <YStack flex={1} minWidth={0}>
                <XStack ai="center" gap="$1.5" minWidth={0}>
                  {symbolText}
                  {badgeElement}
                </XStack>
                {fixedLine}
              </YStack>
            </XStack>
            <XStack {...COLUMNS.network} ai="center" gap="$2">
              <NetworkAvatar networkId={row.networkId} size="$5" />
              <SizableText size="$bodyMd" numberOfLines={1} flexShrink={1}>
                {networkName ?? ''}
              </SizableText>
            </XStack>
            <YStack {...COLUMNS.balance}>
              <RowBalance row={row} />
            </YStack>
            <YStack {...COLUMNS.apr}>
              <OfferRate offer={best} />
              <YearlyLine row={row} />
            </YStack>
            <XStack w={ACTION_WIDTH} flexShrink={0} jc="flex-end">
              <Button
                testID={`earn-desktop-hold-earn-${row.networkId}-${symbol}`}
                size="small"
                variant="secondary"
                // The row is the Tab stop with the same action: one stop a
                // row, not two
                tabIndex={-1}
                transition={colorTransition}
                animateOnly={ANIMATE_ONLY_BG_COLOR}
                // Button stops the press at itself, so the row under it does
                // not open the same page a second time. Stopping the press-in
                // too keeps the row at its hover color while the button is
                // held, so only the button looks pressed
                onPressIn={handleButtonPressIn}
                onPress={onPress}
              >
                {intl.formatMessage({ id: ETranslations.earn_title })}
              </Button>
            </XStack>
          </>
        ) : (
          <>
            {/* One column has no room for a network column: the badge and
                the second line carry the network */}
            <YStack mt={NARROW_ICON_MT}>
              <SurfaceToken
                size="md"
                tokenImageUri={row.token.logoURI || row.asset.logoURI}
                networkId={row.networkId}
              />
            </YStack>
            <YStack flex={1} minWidth={0}>
              {symbolText}
              <SizableText
                size="$bodySm"
                color="$textSubdued"
                numberOfLines={1}
              >
                {networkName ?? ''}
              </SizableText>
            </YStack>
            {/* A number is never cut short: the names give way first */}
            <YStack ai="flex-end" flexShrink={0}>
              <RowBalance row={row} />
            </YStack>
            {/* A phone's width has no room for the badge beside the symbol
                or the rate; under the rate's lines it still says why the
                rate is green */}
            <YStack ai="flex-end" flexShrink={0} minWidth={NARROW_RATE_WIDTH}>
              <OfferRate offer={best} />
              <YearlyLine row={row} />
              {badgeElement ? <XStack mt="$1.5">{badgeElement}</XStack> : null}
            </YStack>
          </>
        )}
      </XStack>
    </EarnDesktopSurfaceProvider>
  );
}

// The card re-renders when the page loses or regains focus (the deposit
// modal opening or closing); the rows keep their render
const HoldRow = memo(BasicHoldRow);

function HeaderLabel({
  children,
  align = 'left',
}: {
  children: string;
  align?: 'left' | 'right';
}) {
  return (
    <SizableText
      size="$bodySmMedium"
      color="$textSubdued"
      textAlign={align}
      numberOfLines={1}
    >
      {children}
    </SizableText>
  );
}

function MoreToggle({
  count,
  isExpanded,
  onPress,
}: {
  count: number;
  isExpanded: boolean;
  onPress: () => void;
}) {
  const intl = useIntl();
  // Subdued until hovered, the way the tile titles brighten
  const [isHovered, setIsHovered] = useState(false);
  // Show less keeps the control where it was pressed: the page scrolls up
  // with the rows folding above it
  const toggleRef = useRef<IElement>(null);
  const pinScroll = useEarnDesktopScrollPin();
  const handlePress = () => {
    if (isExpanded) {
      pinScroll(toggleRef.current);
    }
    onPress();
  };
  return (
    <XStack
      ref={toggleRef}
      testID="earn-desktop-hold-more"
      role="button"
      aria-expanded={isExpanded}
      alignSelf="flex-start"
      ai="center"
      gap="$0.5"
      h={44}
      cursor="pointer"
      userSelect="none"
      onHoverIn={() => setIsHovered(true)}
      onHoverOut={() => setIsHovered(false)}
      onPress={handlePress}
      {...buildKeyboardPressProps(handlePress, 2)}
    >
      <SizableText
        size="$bodyMdMedium"
        color={isHovered ? '$text' : '$textSubdued'}
      >
        {isExpanded
          ? intl.formatMessage({ id: ETranslations.global_show_less })
          : EARN_DESKTOP_DEMO_COPY.showMore(count)}
      </SizableText>
      <Icon
        name={isExpanded ? 'ChevronTopSmallOutline' : 'ChevronDownSmallOutline'}
        size="$4"
        color={isHovered ? '$icon' : '$iconSubdued'}
      />
    </XStack>
  );
}

// The column labels, on the page over the tiles' content
function HoldLabels() {
  const intl = useIntl();
  return (
    <XStack h="$8" ai="center" gap={ROW_GAP} px="$4" mt="$3">
      <Stack {...COLUMNS.asset}>
        <HeaderLabel>
          {intl.formatMessage({ id: ETranslations.global_asset })}
        </HeaderLabel>
      </Stack>
      <Stack {...COLUMNS.network}>
        <HeaderLabel>
          {intl.formatMessage({ id: ETranslations.global_network })}
        </HeaderLabel>
      </Stack>
      <Stack {...COLUMNS.balance}>
        <HeaderLabel align="right">
          {intl.formatMessage({ id: ETranslations.global_wallet_balance })}
        </HeaderLabel>
      </Stack>
      <Stack {...COLUMNS.apr}>
        <HeaderLabel align="right">
          {intl.formatMessage({ id: ETranslations.defi_apr_apy })}
        </HeaderLabel>
      </Stack>
      <Stack w={ACTION_WIDTH} flexShrink={0} />
    </XStack>
  );
}

const toWarmTarget = (row: IEarnDesktopHoldRow) => ({
  symbol: row.asset.symbol,
  networkId: row.networkId,
  offers: row.offers,
});

/**
 * Earns on your holding: what the wallet holds, a row per token per network,
 * with the best rate Earn has for it on that network. The title and labels
 * stand on the page and every row is a tile of its own, so the section reads
 * in layers instead of as one flat card. A row opens the deposit modal for that
 * token on that network.
 *
 * On the phone home the section shows its first rows under the phone's
 * section title, whose chevron opens the page with every row; that page
 * shows them all with no title of its own.
 */
function BasicEarnDesktopHoldCard({
  rows,
  networkNames,
  onOpenRow,
  variant = 'section',
  onOpenAll,
}: {
  rows: IEarnDesktopHoldRow[];
  networkNames: Map<string, string>;
  onOpenRow: (row: IEarnDesktopHoldRow) => void;
  variant?: 'section' | 'phone' | 'page';
  /** The phone home: the page with every row */
  onOpenAll?: () => void;
}) {
  const intl = useIntl();
  const media = useMedia();
  const reduceMotion = useReducedMotion();
  const isWide = media.gtMd && variant !== 'phone';
  const [isExpanded, setIsExpanded] = useState(false);
  let shown = isExpanded ? rows : rows.slice(0, ROW_LIMIT);
  if (variant === 'phone') {
    shown = rows.slice(0, PHONE_ROW_LIMIT);
  } else if (variant === 'page') {
    shown = rows;
  }
  const warm = useWarmOffersDeposit();
  const handleWarmRow = useCallback(
    (row: IEarnDesktopHoldRow) => warm(toWarmTarget(row)),
    [warm],
  );
  // The deposit modal's code and every row's offers as the holdings show,
  // with no request; a row's form data once the pointer rests on it
  useEffect(() => {
    rows.forEach((row) => warm(toWarmTarget(row), { withData: false }));
  }, [rows, warm]);
  // And the rows on screen read ahead once the page is quiet, one after
  // another, so a tap (no hover on a phone) or a quick click opens the modal
  // complete too
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const shownKey = shown.map((row) => row.key).join('|');
  useEffect(() => {
    let index = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const readNext = () => {
      const row = shownRef.current[index];
      if (!row) {
        return;
      }
      index += 1;
      warm(toWarmTarget(row));
      timer = setTimeout(readNext, READ_AHEAD_GAP_MS);
    };
    timer = setTimeout(readNext, READ_AHEAD_DELAY_MS);
    return () => clearTimeout(timer);
  }, [shownKey, warm]);
  const moreCount = rows.length - ROW_LIMIT;
  const renderRow = (row: IEarnDesktopHoldRow) => (
    <HoldRow
      key={row.key}
      row={row}
      networkName={networkNames.get(row.networkId)}
      isWide={isWide}
      onOpenRow={onOpenRow}
      onWarmRow={handleWarmRow}
    />
  );
  if (variant === 'phone') {
    return (
      <YStack gap="$3">
        {/* The chevron only when the page holds more than the rows here */}
        <EarnPhoneSectionTitle
          title={intl.formatMessage({
            id: ETranslations.earns_on_your_holding__title,
          })}
          testID="earn-phone-holdings-title"
          onPress={rows.length > PHONE_ROW_LIMIT ? onOpenAll : undefined}
        />
        <YStack gap="$2" px="$pagePadding">
          {shown.map(renderRow)}
        </YStack>
      </YStack>
    );
  }
  if (variant === 'page') {
    return (
      <YStack>
        {isWide ? <HoldLabels /> : null}
        <YStack gap="$2" mt={isWide ? '$1' : 0}>
          {shown.map(renderRow)}
        </YStack>
      </YStack>
    );
  }
  return (
    // The wider gap above sets the title apart from the hero
    <YStack mt="$4">
      <SizableText size="$headingXl">
        {intl.formatMessage({ id: ETranslations.earns_on_your_holding__title })}
      </SizableText>
      {isWide ? <HoldLabels /> : null}
      <YStack gap="$2" mt={isWide ? '$1' : '$3'}>
        {rows.slice(0, ROW_LIMIT).map(renderRow)}
      </YStack>
      {/* The rest unfold under the first rows as the deposit modal's lists
          do, and fade as they fold */}
      {moreCount > 0 ? (
        <Accordion
          type="single"
          collapsible
          value={isExpanded ? MORE_ROWS_VALUE : ''}
        >
          <Accordion.Item value={MORE_ROWS_VALUE}>
            <Accordion.HeightAnimator
              transition={getListHeightTransition(isExpanded, reduceMotion)}
            >
              <Accordion.Content
                unstyled
                transition="quick"
                animateOnly={ANIMATE_ONLY_OPACITY}
                exitStyle={LIST_HIDDEN_STYLE}
              >
                <YStack gap="$2" pt="$2">
                  {rows.slice(ROW_LIMIT).map((row, index) => (
                    <YStack
                      key={row.key}
                      {...getListRowMotion(index, reduceMotion)}
                    >
                      {renderRow(row)}
                    </YStack>
                  ))}
                </YStack>
              </Accordion.Content>
            </Accordion.HeightAnimator>
          </Accordion.Item>
        </Accordion>
      ) : null}
      {moreCount > 0 ? (
        // On the tiles' content edge, under the token icons
        <XStack pl="$4">
          <MoreToggle
            count={moreCount}
            isExpanded={isExpanded}
            onPress={() => setIsExpanded((prev) => !prev)}
          />
        </XStack>
      ) : (
        // The room the "N more" line leaves under its text, so the next
        // section starts as far below a short list
        <YStack h="$3" />
      )}
    </YStack>
  );
}

// A bar in a box of the loaded text's line height
function SkeletonLine({
  height,
  width,
  barHeight,
}: {
  height: number;
  width: number;
  barHeight: number;
}) {
  return (
    <YStack h={height} jc="center">
      <Skeleton w={width} h={barHeight} borderRadius="$2" />
    </YStack>
  );
}

// An amount over its second line, as the balance and rate columns show them
function SkeletonPair({ top, bottom }: { top: number; bottom: number }) {
  return (
    <>
      <SkeletonLine height={24} width={top} barHeight={16} />
      <SkeletonLine height={16} width={bottom} barHeight={12} />
    </>
  );
}

// The loaded section's boxes, a full page of tiles and the "N more" line
// included, so the page keeps its height when the rows land
export function EarnDesktopHoldCardSkeleton({
  variant = 'section',
}: {
  variant?: 'section' | 'phone' | 'page';
}) {
  const media = useMedia();
  const isWide = media.gtMd && variant !== 'phone';
  const surfaces = useEarnDesktopSurfaces();
  const isPhone = variant === 'phone';
  let rowCount = ROW_LIMIT;
  if (isPhone) {
    rowCount = PHONE_ROW_LIMIT;
  }
  let title: ReactNode = (
    <SkeletonLine height={28} width={200} barHeight={20} />
  );
  if (isPhone) {
    // The phone section title's row
    title = (
      <XStack minHeight="$12" px="$pagePadding" py="$1" ai="center">
        <Skeleton w={200} h={20} borderRadius="$2" />
      </XStack>
    );
  } else if (variant === 'page') {
    title = null;
  }
  return (
    <YStack mt={variant === 'section' ? '$4' : 0} gap={isPhone ? '$3' : 0}>
      {title}
      {isWide ? (
        <XStack h="$8" ai="center" gap={ROW_GAP} px="$4" mt="$3">
          <Stack {...COLUMNS.asset}>
            <Skeleton w={40} h={12} borderRadius="$2" />
          </Stack>
          <Stack {...COLUMNS.network}>
            <Skeleton w={52} h={12} borderRadius="$2" />
          </Stack>
          <Stack {...COLUMNS.balance}>
            <Skeleton w={84} h={12} borderRadius="$2" />
          </Stack>
          <Stack {...COLUMNS.apr}>
            <Skeleton w={52} h={12} borderRadius="$2" />
          </Stack>
          <Stack w={ACTION_WIDTH} flexShrink={0} />
        </XStack>
      ) : null}
      <YStack
        gap="$2"
        mt={isWide || variant !== 'section' ? '$1' : '$3'}
        px={isPhone ? '$pagePadding' : undefined}
      >
        {Array.from({ length: rowCount }).map((_, index) => (
          <XStack
            key={index}
            ai="center"
            gap={ROW_GAP}
            h={ROW_HEIGHT}
            px="$4"
            borderRadius="$3"
            borderCurve="continuous"
            bg={surfaces.rest}
          >
            {isWide ? (
              <>
                <XStack {...COLUMNS.asset} ai="center" gap="$3">
                  <Skeleton w="$8" h="$8" radius="round" />
                  <Skeleton w={56} h={16} borderRadius="$2" />
                </XStack>
                <XStack {...COLUMNS.network} ai="center" gap="$2">
                  <Skeleton w="$5" h="$5" radius="round" />
                  <Skeleton w={64} h={14} borderRadius="$2" />
                </XStack>
                <YStack {...COLUMNS.balance}>
                  <SkeletonPair top={72} bottom={48} />
                </YStack>
                <YStack {...COLUMNS.apr}>
                  <SkeletonPair top={48} bottom={88} />
                </YStack>
                <XStack w={ACTION_WIDTH} flexShrink={0} jc="flex-end">
                  <Skeleton w={52} h={30} radius="round" />
                </XStack>
              </>
            ) : (
              <>
                <Skeleton w="$8" h="$8" radius="round" />
                <YStack flex={1} minWidth={0}>
                  <SkeletonPair top={48} bottom={64} />
                </YStack>
                <YStack ai="flex-end">
                  <SkeletonPair top={72} bottom={48} />
                </YStack>
                <YStack ai="flex-end" minWidth={NARROW_RATE_WIDTH}>
                  <SkeletonPair top={48} bottom={88} />
                </YStack>
              </>
            )}
          </XStack>
        ))}
      </YStack>
      {variant === 'section' ? (
        <XStack h={44} ai="center" pl="$4">
          <Skeleton w={88} h={14} borderRadius="$2" />
        </XStack>
      ) : null}
    </YStack>
  );
}

export const EarnDesktopHoldCard = memo(BasicEarnDesktopHoldCard);
