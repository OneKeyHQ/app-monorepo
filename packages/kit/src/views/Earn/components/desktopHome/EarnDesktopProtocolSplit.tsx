import { useCallback, useEffect, useRef, useState } from 'react';

import { useIsFocused } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import { Platform } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import {
  SizableText,
  Skeleton,
  Tooltip,
  XStack,
  YStack,
  getFontSize,
} from '@onekeyhq/components';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { Token } from '@onekeyhq/kit/src/components/Token';
import {
  useSettingsPersistAtom,
  useSettingsValuePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { ANIMATE_ONLY_BG_COLOR } from './earnDesktopColorEase';
import { formatSharePercent } from './earnDesktopHome.utils';
import { EARN_DESKTOP_DEMO_COPY } from './earnDesktopHomeCopy';
import { buildKeyboardPressProps } from './earnDesktopPressable';

import type {
  IEarnDesktopShare,
  IEarnDesktopShares,
} from './earnDesktopHome.utils';

// Lightness steps, the biggest share brightest. Color on these pages means
// status (earnings, risk), so the protocols' logos tell them apart instead
const SHARE_COLORS = ['$neutral11', '$neutral9', '$neutral7'] as const;
const REST_SHARE_COLOR = '$neutral5';
// The share pointed at takes the strongest step; the others step back
const ACTIVE_SHARE_COLOR = '$neutral12';
const RESTING_SHARE_OPACITY = 0.4;
const BAR_HEIGHT = 10;
// The bar is thin: the pointer finds a share anywhere in this band
const BAR_HIT_HEIGHT = 22;
const SEGMENT_GAP = 2;
// A share that rounds to nothing still has room to be pointed at
const MIN_SEGMENT_WIDTH = 8;
// The tokens a hover card names before "+N"
const CARD_TOKEN_COUNT = 3;
// The protocols "N more" lists before counting the rest
const REST_CARD_ROW_COUNT = 8;
const REST_KEY = '__rest';
// Crossing the gap between two legend entries, the bar doesn't flicker back
// for a moment
const RELEASE_DELAY_MS = 90;
// How far a hidden amount's asterisks drop, as a share of their size
const ASTERISK_DROP = 0.16;
// The web animation driver writes these names into CSS as they are
const ANIMATE_ONLY_FLEX_GROW = Platform.select({
  web: ['flex-grow'],
  default: ['flexGrow'],
});
const ANIMATE_ONLY_TONE = Platform.select({
  web: ['background-color', 'opacity'],
  default: ['backgroundColor', 'opacity'],
});

// Skeletons in the loaded boxes, so nothing below moves as they load
export function SkeletonLine({
  height,
  width,
  barHeight,
}: {
  height: number;
  width: number | string;
  barHeight: number;
}) {
  return (
    <YStack h={height} jc="center">
      <Skeleton w={width} h={barHeight} borderRadius="$2" />
    </YStack>
  );
}

export function ProtocolSplitSkeleton() {
  return (
    <YStack gap="$3.5">
      <Skeleton h="$2.5" w="100%" borderRadius="$full" />
      <XStack gap="$8">
        {Array.from({ length: 3 }).map((_, index) => (
          <YStack key={index} gap="$1">
            <SkeletonLine height={20} width={96} barHeight={14} />
            <SkeletonLine height={24} width={40} barHeight={16} />
          </YStack>
        ))}
      </XStack>
    </YStack>
  );
}

type ISplitItem = {
  key: string;
  value: number;
  color: string;
  share?: IEarnDesktopShare;
};

type IActiveShare = { key: string; source: 'bar' | 'legend' };

function CardRow({ label, value }: { label: string; value: number }) {
  const [settings] = useSettingsPersistAtom();
  const [{ hideValue: isHidden }] = useSettingsValuePersistAtom();
  return (
    <XStack ai="center" jc="space-between" gap="$6">
      <SizableText size="$bodyMd" color="$textSubdued">
        {label}
      </SizableText>
      <NumberSizeableTextWrapper
        hideValue
        size="$bodyMd"
        formatter="value"
        formatterOptions={{ currency: settings.currencyInfo.symbol }}
        y={
          isHidden
            ? Math.round(getFontSize('$bodyMd') * ASTERISK_DROP)
            : undefined
        }
      >
        {String(value)}
      </NumberSizeableTextWrapper>
    </XStack>
  );
}

// A protocol's hover card: what it is worth and what it holds; a lending
// market also says what is supplied and borrowed, the value being the two
// apart
function ShareCard({ share }: { share: IEarnDesktopShare }) {
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();
  const [{ hideValue: isHidden }] = useSettingsValuePersistAtom();
  const tokens = share.tokens ?? [];
  const shownTokens = tokens.slice(0, CARD_TOKEN_COUNT);
  const moreTokens = tokens.length - shownTokens.length;
  return (
    <YStack gap="$2" minWidth={200}>
      <XStack ai="center" jc="space-between" gap="$6">
        <XStack ai="center" gap="$1.5" minWidth={0} flexShrink={1}>
          <Token size="xs" tokenImageUri={share.logoURI} />
          <SizableText size="$bodyMdMedium" numberOfLines={1}>
            {share.name}
          </SizableText>
        </XStack>
        <NumberSizeableTextWrapper
          hideValue
          size="$bodyMdMedium"
          formatter="value"
          formatterOptions={{ currency: settings.currencyInfo.symbol }}
          y={
            isHidden
              ? Math.round(getFontSize('$bodyMdMedium') * ASTERISK_DROP)
              : undefined
          }
        >
          {String(share.value)}
        </NumberSizeableTextWrapper>
      </XStack>
      {share.debtValue ? (
        <YStack gap="$1">
          <CardRow
            label={intl.formatMessage({
              id: ETranslations.wallet_defi_asset_type_supplied,
            })}
            value={share.value + share.debtValue}
          />
          <CardRow
            label={intl.formatMessage({
              id: ETranslations.wallet_defi_asset_type_borrowed,
            })}
            value={share.debtValue}
          />
        </YStack>
      ) : null}
      {shownTokens.length ? (
        <XStack ai="center" gap="$2.5" flexWrap="wrap">
          {shownTokens.map((token) => (
            <XStack key={token.symbol} ai="center" gap="$1">
              <Token size="xxs" tokenImageUri={token.logoURI} />
              <SizableText size="$bodySm" color="$textSubdued">
                {token.symbol}
              </SizableText>
            </XStack>
          ))}
          {moreTokens > 0 ? (
            <SizableText size="$bodySm" color="$textSubdued">
              {`+${moreTokens}`}
            </SizableText>
          ) : null}
        </XStack>
      ) : null}
    </YStack>
  );
}

// "N more" named, each with its share
function RestCard({ items }: { items: IEarnDesktopShare[] }) {
  const shown = items.slice(0, REST_CARD_ROW_COUNT);
  const moreCount = items.length - shown.length;
  return (
    <YStack gap="$2" minWidth={180}>
      {shown.map((item) => (
        <XStack key={item.key} ai="center" jc="space-between" gap="$6">
          <XStack ai="center" gap="$1.5" minWidth={0} flexShrink={1}>
            <Token size="xs" tokenImageUri={item.logoURI} />
            <SizableText size="$bodyMd" numberOfLines={1}>
              {item.name}
            </SizableText>
          </XStack>
          <SizableText size="$bodyMdMedium">
            {formatSharePercent(item.percent)}
          </SizableText>
        </XStack>
      ))}
      {moreCount > 0 ? (
        <SizableText size="$bodySm" color="$textSubdued">
          {EARN_DESKTOP_DEMO_COPY.more(moreCount)}
        </SizableText>
      ) : null}
    </YStack>
  );
}

// Where a total sits: the biggest shares by name, the rest as "N more". The
// home's hero and My portfolio draw the same bar
function StaticProtocolSplit({ shares }: { shares: IEarnDesktopShares }) {
  const restValue =
    shares.total - shares.top.reduce((sum, item) => sum + item.value, 0);
  return (
    <YStack gap="$3.5">
      <XStack h="$2.5" gap="$0.5" borderRadius="$full" overflow="hidden">
        {shares.top.map((item, index) => (
          <YStack key={item.key} flex={item.value} bg={SHARE_COLORS[index]} />
        ))}
        {shares.rest ? <YStack flex={restValue} bg={REST_SHARE_COLOR} /> : null}
      </XStack>
      {/* Four a row at a phone's width too */}
      <XStack gap="$8" $md={{ gap: '$5' }} flexWrap="wrap">
        {shares.top.map((item) => (
          <YStack key={item.key} gap="$1">
            <XStack gap="$1.5" ai="center">
              <Token size="xs" tokenImageUri={item.logoURI} />
              <SizableText size="$bodyMd" color="$textSubdued">
                {item.name}
              </SizableText>
            </XStack>
            <SizableText size="$bodyLgMedium">
              {formatSharePercent(item.percent)}
            </SizableText>
          </YStack>
        ))}
        {shares.rest ? (
          <YStack gap="$1">
            <SizableText size="$bodyMd" color="$textSubdued">
              {EARN_DESKTOP_DEMO_COPY.more(shares.rest.count)}
            </SizableText>
            <SizableText size="$bodyLgMedium">
              {formatSharePercent(shares.rest.percent)}
            </SizableText>
          </YStack>
        ) : null}
      </XStack>
    </YStack>
  );
}

/**
 * The bar as a table of contents of My portfolio: a share and its legend
 * entry are one. Pointing at either (or focusing the entry) brings that share
 * forward, steps the others back and shows its card: what it is worth and
 * what it holds; "N more" names the rest. Pressing opens the share's
 * positions, "N more" those of all it counts
 */
function InteractiveProtocolSplit({
  shares,
  onOpenProtocols,
  onWarm,
}: {
  shares: IEarnDesktopShares;
  onOpenProtocols: (keys: string[]) => void;
  onWarm?: () => void;
}) {
  const reduceMotion = useReducedMotion();
  // Under another page the home keeps its focus where it was; Tab there
  // opens no card over that page
  const isFocused = useIsFocused();
  const [active, setActive] = useState<IActiveShare | undefined>();
  // The figures the bar first shows just appear; a new one fades in
  const [hasShown, setHasShown] = useState(false);
  useEffect(() => setHasShown(true), []);
  const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  useEffect(() => () => clearTimeout(releaseTimerRef.current), []);
  const activate = useCallback(
    (key: string, source: IActiveShare['source']) => {
      if (!isFocused) {
        return;
      }
      clearTimeout(releaseTimerRef.current);
      setActive({ key, source });
      onWarm?.();
    },
    [isFocused, onWarm],
  );
  const deactivate = useCallback(
    (key: string, source: IActiveShare['source']) => {
      clearTimeout(releaseTimerRef.current);
      releaseTimerRef.current = setTimeout(
        () =>
          setActive((current) =>
            current?.key === key && current.source === source
              ? undefined
              : current,
          ),
        RELEASE_DELAY_MS,
      );
    },
    [],
  );
  useEffect(() => {
    if (!isFocused) {
      setActive(undefined);
    }
  }, [isFocused]);
  // Escape puts the card away; focus stays where it is
  useEffect(() => {
    if (!active || typeof document === 'undefined') {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        clearTimeout(releaseTimerRef.current);
        setActive(undefined);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [active]);
  const { rest } = shares;
  const restValue =
    shares.total - shares.top.reduce((sum, item) => sum + item.value, 0);
  const items: ISplitItem[] = [
    ...shares.top.map((share, index) => ({
      key: share.key,
      value: share.value,
      color: SHARE_COLORS[index],
      share,
    })),
    ...(rest
      ? [{ key: REST_KEY, value: restValue, color: REST_SHARE_COLOR }]
      : []),
  ];
  const open = (item: ISplitItem) => {
    const keys = item.share
      ? [item.share.key]
      : (rest?.items ?? []).map((share) => share.key);
    clearTimeout(releaseTimerRef.current);
    setActive(undefined);
    if (keys.length) {
      onOpenProtocols(keys);
    }
  };
  const renderCard = (item: ISplitItem) =>
    item.share ? (
      <ShareCard share={item.share} />
    ) : (
      <RestCard items={rest?.items ?? []} />
    );
  const toneTransition = reduceMotion ? undefined : 'quick';

  return (
    <YStack gap="$3.5">
      <XStack
        h={BAR_HIT_HEIGHT}
        my={-(BAR_HIT_HEIGHT - BAR_HEIGHT) / 2}
        aria-hidden
      >
        {items.map((item, index) => {
          const isFirst = index === 0;
          const isLast = index === items.length - 1;
          const isActive = active?.key === item.key;
          return (
            <Tooltip
              key={item.key}
              placement="top"
              triggerAsChild
              open={isActive && active?.source === 'bar'}
              renderContent={renderCard(item)}
              renderTrigger={
                <YStack
                  testID={`earn-split-segment-${item.key}`}
                  flex={item.value}
                  minWidth={MIN_SEGMENT_WIDTH}
                  h="100%"
                  jc="center"
                  pr={isLast ? 0 : SEGMENT_GAP}
                  cursor="pointer"
                  // A share's width eases when the figures move
                  transition={reduceMotion ? undefined : 'smooth'}
                  animateOnly={ANIMATE_ONLY_FLEX_GROW}
                  onHoverIn={() => activate(item.key, 'bar')}
                  onHoverOut={() => deactivate(item.key, 'bar')}
                  onPress={() => open(item)}
                >
                  <YStack
                    h={BAR_HEIGHT}
                    bg={isActive ? ACTIVE_SHARE_COLOR : item.color}
                    opacity={active && !isActive ? RESTING_SHARE_OPACITY : 1}
                    borderTopLeftRadius={isFirst ? '$full' : 0}
                    borderBottomLeftRadius={isFirst ? '$full' : 0}
                    borderTopRightRadius={isLast ? '$full' : 0}
                    borderBottomRightRadius={isLast ? '$full' : 0}
                    transition={toneTransition}
                    animateOnly={ANIMATE_ONLY_TONE}
                  />
                </YStack>
              }
            />
          );
        })}
      </XStack>
      {/* Four a row at a phone's width too. Each entry pads its hover color
          and takes it back with margins, so the words stay where they were */}
      <XStack gap="$8" $md={{ gap: '$5' }} flexWrap="wrap">
        {items.map((item) => {
          const isActive = active?.key === item.key;
          const name = item.share
            ? item.share.name
            : EARN_DESKTOP_DEMO_COPY.more(rest?.count ?? 0);
          const percent = formatSharePercent(
            item.share ? item.share.percent : (rest?.percent ?? 0),
          );
          const press = () => open(item);
          return (
            <Tooltip
              key={item.key}
              placement="bottom"
              triggerAsChild
              open={isActive && active?.source === 'legend'}
              renderContent={renderCard(item)}
              renderTrigger={
                <YStack
                  testID={`earn-split-entry-${item.key}`}
                  role="button"
                  aria-label={`${name} ${percent}`}
                  gap="$1"
                  px="$2"
                  mx="$-2"
                  py="$1"
                  my="$-1"
                  borderRadius="$2"
                  borderCurve="continuous"
                  bg={isActive ? '$bgHover' : 'transparent'}
                  pressStyle={{ bg: '$bgActive' }}
                  cursor="pointer"
                  userSelect="none"
                  transition={toneTransition}
                  animateOnly={ANIMATE_ONLY_BG_COLOR}
                  onHoverIn={() => activate(item.key, 'legend')}
                  onHoverOut={() => deactivate(item.key, 'legend')}
                  onFocus={() => activate(item.key, 'legend')}
                  onBlur={() => deactivate(item.key, 'legend')}
                  onPress={press}
                  {...buildKeyboardPressProps(press)}
                >
                  <XStack gap="$1.5" ai="center">
                    {item.share ? (
                      <Token size="xs" tokenImageUri={item.share.logoURI} />
                    ) : null}
                    <SizableText size="$bodyMd" color="$textSubdued">
                      {name}
                    </SizableText>
                  </XStack>
                  {/* A new figure fades in */}
                  <SizableText
                    key={percent}
                    size="$bodyLgMedium"
                    enterStyle={
                      reduceMotion || !hasShown ? undefined : { opacity: 0 }
                    }
                    transition={toneTransition}
                  >
                    {percent}
                  </SizableText>
                </YStack>
              }
            />
          );
        })}
      </XStack>
    </YStack>
  );
}

// Where a total sits: the biggest shares by name, the rest as "N more". The
// home's hero and My portfolio draw the same bar; given where a share's
// positions are, it opens them
export function ProtocolSplit({
  shares,
  onOpenProtocols,
  onWarm,
}: {
  shares: IEarnDesktopShares;
  /** A share's protocol key, or for "N more" the keys it counts */
  onOpenProtocols?: (keys: string[]) => void;
  /** Loads the page a press opens, while a share is pointed at or focused */
  onWarm?: () => void;
}) {
  if (!onOpenProtocols) {
    return <StaticProtocolSplit shares={shares} />;
  }
  return (
    <InteractiveProtocolSplit
      shares={shares}
      onOpenProtocols={onOpenProtocols}
      onWarm={onWarm}
    />
  );
}
