import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { isNil } from 'lodash';
import { useIntl } from 'react-intl';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  type GestureResponderEvent,
  type HostInstance,
  PanResponder,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';

import type { ICheckedState, IYStackProps } from '@onekeyhq/components';
import {
  Checkbox,
  Dialog,
  Icon,
  IconButton,
  Image,
  ScrollView,
  SizableText,
  Skeleton,
  Stack,
  Toast,
  XStack,
  YStack,
  useMedia,
  useTheme,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ResourceBannerCard } from '@onekeyhq/kit/src/components/Resource';
import { useBotWalletDeactivatedStatus } from '@onekeyhq/kit/src/hooks/useBotWalletDeactivatedStatus';
import useListenTabFocusState from '@onekeyhq/kit/src/hooks/useListenTabFocusState';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useWalletBanner } from '@onekeyhq/kit/src/hooks/useWalletBanner';
import {
  useAccountOverviewActions,
  useWalletTopBannersAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountOverview';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { shouldBlockBotWalletReceive } from '@onekeyhq/kit/src/utils/botWalletStatusUtils';
import { WALLET_BANNER_IMAGE_SIZE } from '@onekeyhq/kit/src/utils/coldStartImagePreload';
import { beginHomeHeaderMotion } from '@onekeyhq/kit/src/views/Home/pages/homeHeaderMotion';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import {
  HYPERLIQUID_REFERRAL_CODE,
  PERPS_NETWORK_ID,
} from '@onekeyhq/shared/src/consts/perp';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorageKeys';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';
import { ERookieTaskType } from '@onekeyhq/shared/types/rookieGuide';
import type { IWalletBanner } from '@onekeyhq/shared/types/walletBanner';

const PERPS_REFERRAL_BANNER_ID = 'local-perps-referral';

const BANNER_PADDING_H = 20;
// The Tron resource card beside the wide strip; above the stacked cards it
// spans the row instead.
const TRON_CARD_WIDTH = 220;

// A placeholder (not loadingStrategy="skeleton") shows only once a load runs
// past ImageV2's short delay. The skeleton strategy paints a gray square on
// the first frame, which flashes behind transparent banner art each time the
// desktop strip remounts its image on a switch, even when it is cached.
const BANNER_IMAGE_PLACEHOLDER = <Skeleton w="100%" h="100%" radius={8} />;

const closedBanners: Record<string, boolean> = {};

// Wide web home: one banner at a time in a white card. A layered shadow draws
// the card edge; on dark surfaces only the theme-aware ring remains visible.
const STRIP_HEIGHT = 72;
const STRIP_SHADOW =
  '0 0 0 1px var(--neutral3), 0 1px 3px rgba(0, 0, 0, 0.05), 0 4px 10px -4px rgba(0, 0, 0, 0.05)';
const STRIP_SHADOW_HOVER =
  '0 0 0 1px var(--neutral4), 0 1px 3px rgba(0, 0, 0, 0.07), 0 4px 10px -4px rgba(0, 0, 0, 0.08)';
// The web animation driver writes these names into `transition-property`.
// Reduced motion keeps the shadow, opacity and blur changes and drops movement.
const ANIMATE_ONLY_STRIP_CARD = ['box-shadow', 'transform', 'opacity'];
const ANIMATE_ONLY_STRIP_CARD_REDUCED = ['box-shadow', 'opacity'];
const ANIMATE_ONLY_STRIP_CONTENT = ['opacity', 'transform', 'filter'];
const ANIMATE_ONLY_FOLD = ['height', 'margin-top'];
const ANIMATE_ONLY_BACKGROUND = ['background-color'];
// Lengths of the `popoverQuick` (150ms) and `switch` (200ms) presets.
const STRIP_SWAP_MS = 150;
const STRIP_EXIT_MS = 200;
// Felt rather than seen on a card this wide (about 3px in on each side).
const STRIP_PRESS_SCALE = 0.995;
const STRIP_CARD_PROPS: IYStackProps = {
  bg: '$bg',
  // The page panel's radius: a card inside it is never rounder than it.
  borderRadius: '$4',
  outlineWidth: 0,
  my: '$0',
  boxShadow: STRIP_SHADOW,
  hoverStyle: { bg: '$bg', boxShadow: STRIP_SHADOW_HOVER },
};
// The Tron resource card beside the strip: same surface, rows fit in 72. It
// has no controls inside, so a CSS press state is safe; it settles the shadow
// without moving, which also suits reduced motion.
const STRIP_RESOURCE_CARD_PROPS: IYStackProps = {
  ...STRIP_CARD_PROPS,
  px: '$4',
  py: '$2.5',
  pressStyle: { bg: '$bg', boxShadow: STRIP_SHADOW },
  transition: 'popoverQuick',
  animateOnly: ANIMATE_ONLY_STRIP_CARD_REDUCED,
};

const readLastShownBannerId = () =>
  appStorage.syncStorage.getString(
    EAppSyncStorageKeys.onekey_wallet_banner_last_shown_id,
  );

// No timed rotation: each time the user comes back to the wallet tab (mounting
// counts as one visit), the strip shows the banner after the one last seen, so
// every banner gets its turn without motion next to the balance. The pick is
// derived during render from the visit's starting point, so it stays right
// when the cached list is replaced by the filtered one and never flashes.
function useStripBanner(banners: IWalletBanner[]) {
  const [visitStart, setVisitStart] = useState(() => ({
    visit: 1,
    lastShownId: readLastShownBannerId(),
  }));
  const homeFocusedRef = useRef(true);
  useListenTabFocusState(ETabRoutes.Home, (isFocus) => {
    if (isFocus && !homeFocusedRef.current) {
      setVisitStart((prev) => ({
        visit: prev.visit + 1,
        lastShownId: readLastShownBannerId(),
      }));
    }
    homeFocusedRef.current = isFocus;
  });

  // A banner chosen by hand (indicator, arrow keys, closing the previous one)
  // holds for the rest of the visit while it is still listed.
  const [picked, setPicked] = useState<{ visit: number; id: string }>();
  const count = banners.length;
  let index = -1;
  if (picked?.visit === visitStart.visit) {
    index = banners.findIndex((banner) => banner.id === picked.id);
  }
  if (index < 0 && count) {
    const lastIndex = banners.findIndex(
      (banner) => banner.id === visitStart.lastShownId,
    );
    index = (lastIndex + 1) % count;
  }
  const shownId = index >= 0 ? banners[index]?.id : undefined;

  useEffect(() => {
    if (shownId) {
      void appStorage.syncStorage.set(
        EAppSyncStorageKeys.onekey_wallet_banner_last_shown_id,
        shownId,
      );
    }
  }, [shownId]);

  const show = useCallback(
    (id: string) => setPicked({ visit: visitStart.visit, id }),
    [visitStart.visit],
  );
  return { index: Math.max(0, index), show };
}

function StripContent({
  item,
  mediaRadius = '$2',
}: {
  item: IWalletBanner;
  mediaRadius?: '$1' | '$2';
}) {
  return (
    <>
      <StripMedia item={item} radius={mediaRadius} />
      <YStack flex={1} minWidth={0} gap="$0.5">
        <SizableText
          size="$bodyMdMedium"
          numberOfLines={item.description ? 1 : 2}
        >
          {item.title}
        </SizableText>
        {item.description ? (
          <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
            {item.description}
          </SizableText>
        ) : null}
      </YStack>
    </>
  );
}

function StripMedia({
  item,
  radius,
}: {
  item: IWalletBanner;
  radius: '$1' | '$2';
}) {
  if (item.src) {
    return (
      <Stack
        w={WALLET_BANNER_IMAGE_SIZE}
        h={WALLET_BANNER_IMAGE_SIZE}
        borderRadius={radius}
        overflow="hidden"
        flexShrink={0}
      >
        <Image
          size={WALLET_BANNER_IMAGE_SIZE}
          source={{ uri: item.src }}
          // Native images show a placeholder from the first frame, even when
          // cached, which flashes on the stack's freshly mounted copies; phones
          // keep none.
          placeholder={
            platformEnv.isNative ? undefined : BANNER_IMAGE_PLACEHOLDER
          }
        />
      </Stack>
    );
  }
  if (item.icon) {
    return (
      <Stack
        w={WALLET_BANNER_IMAGE_SIZE}
        h={WALLET_BANNER_IMAGE_SIZE}
        borderRadius={radius}
        bg="$bgSuccessSubdued"
        alignItems="center"
        justifyContent="center"
        flexShrink={0}
      >
        <Icon name={item.icon} size="$6" color="$iconSuccess" />
      </Stack>
    );
  }
  return null;
}

function DesktopBannerStrip({
  banners,
  handleBannerOnPress,
  handleDismiss,
  leadingContent,
}: {
  banners: IWalletBanner[];
  handleBannerOnPress: (item: IWalletBanner) => void;
  handleDismiss: (item: IWalletBanner) => void;
  leadingContent?: ReactNode;
}) {
  const intl = useIntl();
  const reduceMotion = useReducedMotion();
  const { index, show } = useStripBanner(banners);
  const item = banners[index] as IWalletBanner | undefined;
  const count = banners.length;
  const [closingId, setClosingId] = useState<string>();
  const closing = !!item && closingId === item.id;
  // The row folds away only with motion and without the Tron card beside it;
  // otherwise just the card fades out.
  const collapseRow = closing && !leadingContent && !reduceMotion;
  // Tracked in JS: a CSS :active state would also fire while the close button
  // or an indicator bar inside the card is pressed.
  const [pressed, setPressed] = useState(false);
  // onPressOut does not fire when the pointer is released outside the card;
  // like a native press, release anywhere ends it.
  useEffect(() => {
    if (!pressed) return;
    const release = () => setPressed(false);
    globalThis.addEventListener('pointerup', release);
    globalThis.addEventListener('pointercancel', release);
    return () => {
      globalThis.removeEventListener('pointerup', release);
      globalThis.removeEventListener('pointercancel', release);
    };
  }, [pressed]);
  // A pointer pick keeps the outgoing banner on top while it fades out, so the
  // two cross-fade instead of the card going blank for a few frames.
  const [leaving, setLeaving] = useState<{
    item: IWalletBanner;
    dir: 1 | -1;
  }>();

  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => setLeaving(undefined), STRIP_SWAP_MS);
    return () => clearTimeout(timer);
  }, [leaving]);

  // `dir` 0 is a keyboard pick: it swaps instantly.
  const switchTo = useCallback(
    (id: string, dir: 1 | -1 | 0) => {
      // A pick while a switch is still sliding cuts instantly, rather than
      // remounting the half-faded banner at full opacity.
      setLeaving(
        dir !== 0 && item && item.id !== id && !leaving
          ? { item, dir }
          : undefined,
      );
      show(id);
    },
    [item, leaving, show],
  );

  const go = useCallback(
    (delta: number) => {
      if (count < 2) return;
      switchTo(banners[(index + delta + count) % count].id, 0);
    },
    [banners, count, index, switchTo],
  );

  const onDismiss = useCallback(() => {
    if (!item || closingId) return;
    // Show the banner that followed the closed one instead of jumping back.
    const after = banners[index + 1];
    const next = after ?? banners[index - 1];
    if (next) {
      switchTo(next.id, after ? 1 : -1);
      handleDismiss(item);
      return;
    }
    // The last banner leaves before it unmounts, so the tabs and token list
    // below glide up (or, with reduced motion, the card fades) instead of the
    // page jumping.
    setClosingId(item.id);
    setTimeout(() => handleDismiss(item), STRIP_EXIT_MS);
  }, [banners, closingId, handleDismiss, index, item, switchTo]);

  const onKeyDown = useCallback(
    (event: {
      key: string;
      target: unknown;
      currentTarget: unknown;
      preventDefault: () => void;
    }) => {
      // Keys pressed on the indicator or close button belong to them.
      if (!item || event.target !== event.currentTarget) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleBannerOnPress(item);
      } else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        go(event.key === 'ArrowRight' ? 1 : -1);
      }
    },
    [go, handleBannerOnPress, item],
  );

  // Presses on the controls must not reach the card's press state.
  const stopPressIn = useCallback((event: GestureResponderEvent) => {
    event.stopPropagation();
  }, []);

  let cardScale = 1;
  if (!reduceMotion && closing) cardScale = 0.98;
  else if (!reduceMotion && pressed) cardScale = STRIP_PRESS_SCALE;
  const shift = reduceMotion ? 0 : 8;
  const contentMotion = {
    transition: 'popoverQuick',
    animateOnly: ANIMATE_ONLY_STRIP_CONTENT,
  } as const;

  return (
    <YStack
      h={collapseRow ? 0 : STRIP_HEIGHT}
      // The fold takes the header stack's 32 gap above the strip with it, so
      // nothing moves when the strip unmounts after the fold.
      mt={collapseRow ? '$-8' : 0}
      overflow={collapseRow ? 'hidden' : 'visible'}
      {...(!reduceMotion && {
        transition: 'switch',
        animateOnly: ANIMATE_ONLY_FOLD,
      })}
    >
      <XStack px="$pagePadding" gap="$3" bg="$bgApp">
        {leadingContent}
        {item ? (
          <XStack
            testID="home-wallet-banner-strip"
            flex={1}
            minWidth={0}
            h={STRIP_HEIGHT}
            pl={20}
            pr="$2.5"
            alignItems="center"
            gap="$3"
            {...STRIP_CARD_PROPS}
            hoverStyle={{
              bg: '$bg',
              boxShadow: pressed ? STRIP_SHADOW : STRIP_SHADOW_HOVER,
            }}
            transition={closing ? 'switch' : 'popoverQuick'}
            animateOnly={
              reduceMotion
                ? ANIMATE_ONLY_STRIP_CARD_REDUCED
                : ANIMATE_ONLY_STRIP_CARD
            }
            opacity={closing ? 0 : 1}
            scale={cardScale}
            pointerEvents={closing ? 'none' : 'auto'}
            aria-hidden={closing ? true : undefined}
            // A click anywhere on the card opens the banner; for keyboards
            // and screen readers the button is the image and words below.
            onPressIn={() => setPressed(true)}
            onPressOut={() => setPressed(false)}
            onPress={() => handleBannerOnPress(item)}
            userSelect="none"
          >
            {/* The banner's button: the image and words only, so the
                indicator and Close beside it stay controls of their own
                rather than parts of it. It reaches back over the card's left
                padding, so its focus ring meets the card's edge there. */}
            <XStack
              flex={1}
              minWidth={0}
              alignSelf="stretch"
              position="relative"
              ml={-20}
              pl={20}
              borderRadius="$4"
              focusable
              tabIndex={0}
              focusVisibleStyle={{
                outlineColor: '$focusRing',
                outlineWidth: 2,
                outlineStyle: 'solid',
                outlineOffset: -2,
              }}
              role="button"
              aria-label={[item.title, item.description]
                .filter(Boolean)
                .join(', ')}
              onKeyDown={onKeyDown}
            >
              {leaving ? (
                <XStack
                  key={`leaving-${leaving.item.id}`}
                  position="absolute"
                  top={0}
                  right={0}
                  bottom={0}
                  left={0}
                  pl={20}
                  alignItems="center"
                  gap="$3"
                  pointerEvents="none"
                  aria-hidden
                  {...contentMotion}
                  enterStyle={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                  opacity={0}
                  x={-leaving.dir * shift}
                  filter={reduceMotion ? undefined : 'blur(2px)'}
                >
                  <StripContent item={leaving.item} />
                </XStack>
              ) : null}
              <XStack
                key={item.id}
                flex={1}
                minWidth={0}
                alignItems="center"
                gap="$3"
                {...(leaving && {
                  ...contentMotion,
                  enterStyle: {
                    opacity: 0,
                    x: leaving.dir * shift,
                    filter: reduceMotion ? undefined : 'blur(2px)',
                  },
                })}
              >
                <StripContent item={item} />
              </XStack>
            </XStack>
            {count > 1 ? (
              <XStack alignItems="center" flexShrink={0}>
                {banners.map((banner, i) => (
                  <Stack
                    key={banner.id}
                    w={24}
                    h={40}
                    alignItems="center"
                    justifyContent="center"
                    role="button"
                    aria-label={`${i + 1} / ${count}`}
                    aria-current={i === index ? 'true' : undefined}
                    // Not a tab stop each: the focused banner button switches
                    // banners with the arrow keys.
                    focusable={false}
                    tabIndex={-1}
                    onKeyDown={(event: {
                      key: string;
                      preventDefault: () => void;
                    }) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        switchTo(banner.id, 0);
                      }
                    }}
                    focusVisibleStyle={{
                      outlineColor: '$focusRing',
                      outlineWidth: 2,
                      outlineStyle: 'solid',
                      outlineOffset: -4,
                    }}
                    borderRadius="$2"
                    hoverStyle={{ bg: '$bgHover' }}
                    pressStyle={{ bg: '$bgActive' }}
                    transition="100ms"
                    animateOnly={ANIMATE_ONLY_BACKGROUND}
                    onPressIn={stopPressIn}
                    onPress={(event: GestureResponderEvent) => {
                      event.stopPropagation();
                      if (i !== index) switchTo(banner.id, i > index ? 1 : -1);
                    }}
                  >
                    <Stack
                      w={12}
                      h={3}
                      borderRadius="$full"
                      bg={i === index ? '$textSubdued' : '$neutral5'}
                    />
                  </Stack>
                ))}
              </XStack>
            ) : null}
            {/* Not closable: keep the slot so the bars stay put between banners. */}
            {item.closeable ? (
              <IconButton
                testID="home-wallet-banner-strip-close"
                variant="tertiary"
                size="medium"
                iconSize="$5"
                p="$2.5"
                m="$0"
                icon="CrossedSmallOutline"
                aria-label={intl.formatMessage({
                  id: ETranslations.global_close,
                })}
                onPressIn={stopPressIn}
                onPress={(event: GestureResponderEvent) => {
                  event.stopPropagation();
                  onDismiss();
                }}
              />
            ) : (
              <Stack w={42} h={42} flexShrink={0} />
            )}
          </XStack>
        ) : null}
      </XStack>
    </YStack>
  );
}

function PerpsReferralDialogContent({
  onConfirm,
  onSnoozeChange,
}: {
  onConfirm: () => Promise<void>;
  onSnoozeChange: (checked: boolean) => void;
}) {
  const intl = useIntl();
  const [snoozed, setSnoozed] = useState<ICheckedState>(false);

  const handleSnoozeChange = useCallback(
    (val: ICheckedState) => {
      setSnoozed(val);
      onSnoozeChange(!!val);
    },
    [onSnoozeChange],
  );

  return (
    <YStack gap="$5">
      <SizableText size="$bodyMd">
        {intl.formatMessage({
          id: ETranslations.perps__claim_fee_discount__desc,
        })}
      </SizableText>

      <Checkbox
        testID="home-handle-snooze-change-checkbox"
        label={intl.formatMessage({
          id: ETranslations.perps__snooze_remind_later__action,
        })}
        value={snoozed}
        onChange={handleSnoozeChange}
      />

      <Dialog.Footer
        onConfirm={onConfirm}
        onConfirmText={intl.formatMessage({
          id: ETranslations.perps__claim_now__action,
        })}
        showCancelButton={false}
      />
    </YStack>
  );
}

// Phones, the extension popup and narrow windows: the banners stack as cards,
// one in front with the edges of up to two more below it. Swiping the front
// card away to the left or tapping the edges brings up the next banner; a
// swipe to the right sends it off to the right and brings up the previous one
// from under it. As on the wide strip, each visit to the wallet tab starts from
// the banner after the one last shown, with no timed rotation.
const STACK_CARD_HEIGHT = 72;
// The wallet action buttons' radius above; the art inside, 12 in from every
// edge, follows it (16 - 12).
const STACK_CARD_RADIUS = '$4';
const STACK_MEDIA_RADIUS = '$1';
// The default tertiary close button draws its 36 circle 7px past its box; this
// right padding leaves the circle 10 from the card's right edge.
const STACK_CLOSE_PAD = 17;
const STACK_PEEK = 6;
// Web: the edges part slightly under the pointer, a hint that they respond.
const STACK_HOVER_PEEK = 8;
const STACK_SCALE_STEP = 0.05;
// The header stack's gap above the banner; closing the last banner folds it.
const STACK_HEADER_GAP = 20;
// A swipe past this share of the card's width, or faster than this (px/s),
// sends the card away; anything less settles it back.
const STACK_SWIPE_RATIO = 0.22;
const STACK_FLING_VELOCITY = 500;
const STACK_DRAG_START = 6;
// Movement past this ends a press as a drag, so it does not open the banner.
const STACK_TAP_SLOP = 5;
const STACK_FLY_OVERSHOOT = 32;
// The fade as a card leaves without moving (reduced motion); a thrown card
// fades with its travel instead, solid until this share of its width is out.
const STACK_FLY_MS = 200;
const STACK_SOLID_RATIO = 0.4;
// A thrown card leaves at the finger's speed; a tap on the edges sends it at
// a light toss (px/s).
const STACK_TOSS_VELOCITY = 1200;
// Critically damped (no bounce). It counts as done once the card is out of
// sight (within 24px of its mark, already faded out), about 0.2s after the
// throw, not when the spring's slow tail settles, so the card takes its new
// place in the stack before the slot it lands in is uncovered.
const STACK_FLY_SPRING = {
  stiffness: 440,
  damping: 42,
  mass: 1,
  overshootClamping: true,
  restDisplacementThreshold: 24,
  restSpeedThreshold: 200,
};
const STACK_MOVE_MS = 300;
const STACK_CLOSE_MS = 150;
const STACK_CONTENT_MS = 150;
const STACK_HOVER_MS = 150;
// About 3px in on each side of a phone-wide card, like the wide strip's press.
const STACK_PRESS_SCALE = 0.98;
const STACK_PRESS_MS = 150;
// Below the edges lies only the header's bottom padding, so their tap target
// reaches into it: 40 tall on touch, 24 with a pointer.
const STACK_EDGE_TOUCH_SLOP = 28;
const STACK_EDGE_POINTER_SLOP = 12;
// The web animation driver writes these names into `transition-property`.
const ANIMATE_ONLY_SHADOW = ['box-shadow'];
const STACK_EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const STACK_EASE_MOVE = Easing.bezier(0.32, 0.72, 0, 1);
// With reduced motion a press dims the content instead of moving the card.
const STACK_PRESS_DIM = 0.85;
const STACK_NATIVE_DRIVER = !!platformEnv.isNative;
// Android's home pager takes horizontal drags in its header unless a
// horizontal scroll view lies under the finger, and its touch lock cancels
// gesture-handler pans there. On Android the stack therefore sits in a
// horizontal scroll view that never scrolls, and the card follows the JS
// responder instead.
const STACK_DRAG_WITH_RESPONDER = platformEnv.isNativeAndroid;

function stackTiming(
  value: Animated.Value,
  toValue: number,
  duration: number,
  easing: (t: number) => number,
) {
  return Animated.timing(value, {
    toValue,
    duration,
    easing,
    useNativeDriver: STACK_NATIVE_DRIVER,
  });
}

// The white card surface: a ring plus two soft shadows, with the ring color
// resolved from the theme so native draws it too. On dark surfaces only the
// ring shows. Under a pointer the ring and shadows deepen, as on the strip.
function useStackCardShadows() {
  const theme = useTheme();
  const rest = theme.neutral3.val;
  const hover = theme.neutral4.val;
  return useMemo(
    () => ({
      rest: `0 0 0 1px ${rest}, 0 1px 3px rgba(0, 0, 0, 0.05), 0 4px 10px -4px rgba(0, 0, 0, 0.05)`,
      hover: `0 0 0 1px ${hover}, 0 1px 3px rgba(0, 0, 0, 0.07), 0 4px 10px -4px rgba(0, 0, 0, 0.08)`,
    }),
    [hover, rest],
  );
}

// The front card's surface and words without its controls, as the rising
// face and the thrown copy draw it.
function BannerStackFaceBody({
  item,
  shadow,
  content,
}: {
  item: IWalletBanner;
  shadow: string;
  content?: Animated.Value;
}) {
  return (
    <XStack
      h={STACK_CARD_HEIGHT}
      pl="$3"
      pr={item.closeable ? STACK_CLOSE_PAD : '$4'}
      alignItems="center"
      bg="$bg"
      borderRadius={STACK_CARD_RADIUS}
      borderCurve="continuous"
      style={{ boxShadow: shadow }}
    >
      <Animated.View
        style={{
          flex: 1,
          minWidth: 0,
          alignSelf: 'stretch',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          opacity: content ?? 1,
        }}
      >
        <XStack flex={1} minWidth={0} alignItems="center" gap="$3">
          <StripContent item={item} mediaRadius={STACK_MEDIA_RADIUS} />
        </XStack>
        {item.closeable ? (
          // Drawn like the card's close button (default tertiary size).
          <Stack p="$1.5" m={-7}>
            <Icon name="CrossedSmallOutline" size="$6" color="$iconSubdued" />
          </Stack>
        ) : null}
      </Animated.View>
    </XStack>
  );
}

// The previous banner's face rising from the second slot to the front after
// a swipe to the right, while its own card waits hidden at the front (it sits
// at the back of the stack until then).
function BannerStackFace({
  item,
  shadow,
  rise,
  content,
}: {
  item: IWalletBanner;
  shadow: string;
  // 1 in the second slot, 0 at the front.
  rise: Animated.Value;
  content: Animated.Value;
}) {
  return (
    <Animated.View
      pointerEvents="none"
      aria-hidden
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        height: STACK_CARD_HEIGHT,
        transformOrigin: '50% 100%',
        // Between the front card and the second one.
        zIndex: 19,
        transform: [
          {
            translateY: rise.interpolate({
              inputRange: [0, 1],
              outputRange: [0, STACK_PEEK],
            }),
          },
          {
            scale: rise.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 1 - STACK_SCALE_STEP],
            }),
          },
        ],
      }}
    >
      <BannerStackFaceBody item={item} shadow={shadow} content={content} />
    </Animated.View>
  );
}

// A copy of a thrown card flying off the screen from where the finger let
// go, at its release speed (a light toss for a tap on the edges), fading as
// it nears the edge. The card itself has already taken its new place.
function BannerStackGhost({
  ghostKey,
  item,
  shadow,
  dir,
  from,
  velocity,
  width,
  reduceMotion,
  onDone,
}: {
  ghostKey: number;
  item: IWalletBanner;
  shadow: string;
  dir: 1 | -1;
  from: number;
  velocity?: number;
  width: number;
  reduceMotion: boolean;
  onDone: (key: number) => void;
}) {
  const [x] = useState(() => new Animated.Value(from));
  const [fade] = useState(() => new Animated.Value(1));
  useEffect(() => {
    const flight = reduceMotion
      ? stackTiming(fade, 0, STACK_FLY_MS, STACK_EASE_OUT)
      : Animated.spring(x, {
          toValue: dir * (width + STACK_FLY_OVERSHOOT),
          velocity:
            velocity === undefined
              ? dir * STACK_TOSS_VELOCITY
              : dir * Math.max(dir * velocity, 0),
          ...STACK_FLY_SPRING,
          useNativeDriver: STACK_NATIVE_DRIVER,
        });
    flight.start(() => onDone(ghostKey));
  }, [dir, fade, ghostKey, onDone, reduceMotion, velocity, width, x]);
  const travel = x.interpolate({
    inputRange: [
      -(width + STACK_FLY_OVERSHOOT),
      -width * STACK_SOLID_RATIO,
      width * STACK_SOLID_RATIO,
      width + STACK_FLY_OVERSHOOT,
    ],
    outputRange: [0, 1, 1, 0],
    extrapolate: 'clamp',
  });
  return (
    <Animated.View
      pointerEvents="none"
      aria-hidden
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        height: STACK_CARD_HEIGHT,
        zIndex: 40,
        opacity: Animated.multiply(fade, travel),
        transform: [{ translateX: x }],
      }}
    >
      <BannerStackFaceBody item={item} shadow={shadow} />
    </Animated.View>
  );
}

function BannerStackCard({
  item,
  depth,
  width,
  canStep,
  jump,
  arriving,
  landing,
  reduceMotion,
  shadows,
  spread,
  flyRequest,
  registerButton,
  onOpen,
  onStep,
  onThrow,
  onLeave,
  onClosed,
  canPull,
}: {
  item: IWalletBanner;
  depth: number;
  width: number;
  canStep: boolean;
  // Keyboard and screen reader picks move the cards at once.
  jump: boolean;
  // Brought up as the previous banner: it takes the front at once but stays
  // hidden while its face rises there.
  arriving: boolean;
  // Just thrown: it takes its new place at once while a copy flies off.
  landing: boolean;
  reduceMotion: boolean;
  shadows: { rest: string; hover: string };
  spread: Animated.Value;
  flyRequest: number;
  registerButton: (id: string, node: unknown) => void;
  onOpen: (item: IWalletBanner) => void;
  onStep: (delta: 1 | -1) => void;
  // Thrown left (next) or right (previous) from where the drag let go.
  onThrow: (
    item: IWalletBanner,
    dir: 1 | -1,
    from: number,
    velocity?: number,
  ) => void;
  // Closing: the next card comes forward at once while this one fades on top.
  onLeave: (id: string, reason: 'close') => void;
  // Close has played out: the banner can go.
  onClosed: (id: string) => void;
  // A swipe to the right can bring up a previous banner.
  canPull: boolean;
}) {
  const intl = useIntl();
  const isTop = depth === 0;
  const itemId = item.id;
  const [depthAnim] = useState(() => new Animated.Value(depth));
  const [contentAnim] = useState(() => new Animated.Value(isTop ? 1 : 0));
  const [tx] = useState(() => new Animated.Value(0));
  const [fade] = useState(() => new Animated.Value(1));
  const [lift] = useState(() => new Animated.Value(0));
  const [press] = useState(() => new Animated.Value(0));
  const [leaving, setLeaving] = useState(false);
  const leavingRef = useRef(false);
  const depthRef = useRef(depth);
  useEffect(() => {
    depthRef.current = depth;
  }, [depth]);

  const prevDepth = useRef(depth);
  useEffect(() => {
    if (prevDepth.current === depth) return;
    prevDepth.current = depth;
    // A closing card keeps its place until it goes.
    if (leavingRef.current) return;
    const content = depth === 0 ? 1 : 0;
    if (jump || arriving || landing || reduceMotion) {
      depthAnim.setValue(depth);
      contentAnim.setValue(content);
      if (arriving) fade.setValue(0);
      if (landing) {
        tx.setValue(0);
        fade.setValue(1);
      }
      return;
    }
    stackTiming(depthAnim, depth, STACK_MOVE_MS, STACK_EASE_MOVE).start();
    stackTiming(contentAnim, content, STACK_CONTENT_MS, STACK_EASE_OUT).start();
  }, [
    arriving,
    contentAnim,
    depth,
    depthAnim,
    fade,
    jump,
    landing,
    reduceMotion,
    tx,
  ]);
  // Its face has risen to the front: the card shows in its place.
  const wasArriving = useRef(false);
  useEffect(() => {
    if (arriving) {
      wasArriving.current = true;
    } else if (wasArriving.current) {
      wasArriving.current = false;
      fade.setValue(1);
    }
  }, [arriving, fade]);

  // Thrown left for the next banner, right for the previous one: a copy
  // flies off from where the drag let go (BannerStackGhost) while this card
  // takes its new place behind the others at once, under the card moving out
  // of that place, so no layer of the stack goes missing.
  const dragX = useRef(0);
  const throwCard = useCallback(
    (dir: 1 | -1, velocity?: number) => {
      onThrow(item, dir, dragX.current, velocity);
      dragX.current = 0;
    },
    [item, onThrow],
  );

  // A tap on the edges behind sends the front card away.
  const lastFlyRequest = useRef(flyRequest);
  useEffect(() => {
    if (flyRequest === lastFlyRequest.current) return;
    lastFlyRequest.current = flyRequest;
    if (isTop && canStep && !arriving && !leavingRef.current) throwCard(-1);
  }, [arriving, canStep, flyRequest, isTop, throwCard]);

  // A drag picks its direction once and this card follows the finger that
  // way only: to the left for the next banner, to the right for the previous.
  const dragMode = useRef<'none' | 'next' | 'prev'>('none');
  const dragTo = useCallback(
    (dx: number) => {
      if (dragMode.current === 'none') {
        // Web reports the drag's first update at 0: wait for a direction.
        if (dx === 0) return;
        dragMode.current = dx > 0 && canStep && canPull ? 'prev' : 'next';
      }
      dragX.current =
        dragMode.current === 'prev' ? Math.max(dx, 0) : Math.min(dx, 0);
      tx.setValue(dragX.current);
    },
    [canPull, canStep, tx],
  );
  const dragEnd = useCallback(
    (dx: number, vx: number) => {
      const mode = dragMode.current;
      dragMode.current = 'none';
      if (
        mode === 'prev' &&
        (dx > width * STACK_SWIPE_RATIO || vx > STACK_FLING_VELOCITY)
      ) {
        throwCard(1, vx);
        return;
      }
      if (
        mode === 'next' &&
        canStep &&
        (dx < -width * STACK_SWIPE_RATIO || vx < -STACK_FLING_VELOCITY)
      ) {
        throwCard(-1, vx);
        return;
      }
      dragX.current = 0;
      stackTiming(tx, 0, STACK_MOVE_MS, STACK_EASE_MOVE).start();
    },
    [canStep, throwCard, tx, width],
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .enabled(isTop && !leaving && !arriving && !STACK_DRAG_WITH_RESPONDER)
        .activeOffsetX([-STACK_DRAG_START, STACK_DRAG_START])
        .failOffsetY([-8, 8])
        .cancelsTouchesInView(false)
        .onStart(() => {
          dragMode.current = 'none';
        })
        .onUpdate((e) => {
          dragTo(e.translationX);
        })
        .onEnd((e) => {
          dragEnd(e.translationX, e.velocityX);
        }),
    [arriving, dragEnd, dragTo, isTop, leaving],
  );

  const dragRef = useRef({ isTop, dragTo, dragEnd });
  useEffect(() => {
    dragRef.current = {
      isTop: isTop && !leaving && !arriving,
      dragTo,
      dragEnd,
    };
  }, [arriving, dragEnd, dragTo, isTop, leaving]);
  const responder = useMemo(
    () =>
      STACK_DRAG_WITH_RESPONDER
        ? PanResponder.create({
            onMoveShouldSetPanResponderCapture: (_event, gesture) =>
              dragRef.current.isTop &&
              Math.abs(gesture.dx) > STACK_DRAG_START &&
              Math.abs(gesture.dx) > Math.abs(gesture.dy),
            onPanResponderTerminationRequest: () => false,
            onPanResponderGrant: () => {
              dragMode.current = 'none';
            },
            onPanResponderMove: (_event, gesture) => {
              dragRef.current.dragTo(gesture.dx);
            },
            // `vx` is in px/ms.
            onPanResponderRelease: (_event, gesture) => {
              dragRef.current.dragEnd(gesture.dx, gesture.vx * 1000);
            },
            // Taken away mid-drag: settle as if let go where it started.
            onPanResponderTerminate: () => {
              dragRef.current.dragEnd(0, 0);
            },
          })
        : undefined,
    [],
  );

  const close = useCallback(() => {
    leavingRef.current = true;
    setLeaving(true);
    onLeave(itemId, 'close');
    const leave = [stackTiming(fade, 0, STACK_CLOSE_MS, STACK_EASE_OUT)];
    if (!reduceMotion) {
      leave.push(stackTiming(lift, 1, STACK_CLOSE_MS, STACK_EASE_OUT));
    }
    Animated.parallel(leave).start(() => onClosed(itemId));
  }, [fade, itemId, lift, onClosed, onLeave, reduceMotion]);

  // The front card gives a little under the finger or pointer.
  const pressTo = useCallback(
    (to: 0 | 1) => {
      stackTiming(press, to, STACK_PRESS_MS, STACK_EASE_OUT).start();
    },
    [press],
  );
  const pressIn = useCallback(() => {
    if (!isTop || leavingRef.current) return;
    pressTo(1);
    if (platformEnv.isNative) return;
    // A web press released off the card never ends on its own.
    const release = () => {
      globalThis.removeEventListener('pointerup', release);
      globalThis.removeEventListener('pointercancel', release);
      pressTo(0);
    };
    globalThis.addEventListener('pointerup', release);
    globalThis.addEventListener('pointercancel', release);
  }, [isTop, pressTo]);
  const pressOut = useCallback(() => pressTo(0), [pressTo]);
  // Presses on Close must not reach the card.
  const stopPressIn = useCallback((event: GestureResponderEvent) => {
    event.stopPropagation();
  }, []);

  // Depth 0–2 shows; a card further back waits behind the last edge, faded.
  const cardMotion = useMemo(() => {
    const shownDepth = depthAnim.interpolate({
      inputRange: [0, 2, 3],
      outputRange: [0, 2, 2],
      extrapolate: 'clamp',
    });
    const peek = spread.interpolate({
      inputRange: [0, 1],
      outputRange: [STACK_PEEK, STACK_HOVER_PEEK],
    });
    const depthScale = depthAnim.interpolate({
      inputRange: [0, 2, 3],
      outputRange: [1, 1 - 2 * STACK_SCALE_STEP, 1 - 2 * STACK_SCALE_STEP],
      extrapolate: 'clamp',
    });
    const depthOpacity = depthAnim.interpolate({
      inputRange: [0, 2, 3],
      outputRange: [1, 1, 0],
      extrapolate: 'clamp',
    });
    // Thrown or dragged aside, the card stays solid near the finger and
    // fades only as it nears the edge of the screen.
    const travelOpacity = tx.interpolate({
      inputRange: [
        -(width + STACK_FLY_OVERSHOOT),
        -width * STACK_SOLID_RATIO,
        width * STACK_SOLID_RATIO,
        width + STACK_FLY_OVERSHOOT,
      ],
      outputRange: [0, 1, 1, 0],
      extrapolate: 'clamp',
    });
    return {
      opacity: Animated.multiply(
        Animated.multiply(fade, depthOpacity),
        travelOpacity,
      ),
      transform: [
        { translateX: tx },
        {
          translateY: Animated.add(
            Animated.multiply(shownDepth, peek),
            lift.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }),
          ),
        },
        {
          scale: Animated.multiply(
            depthScale,
            Animated.multiply(
              lift.interpolate({ inputRange: [0, 1], outputRange: [1, 0.98] }),
              reduceMotion
                ? 1
                : press.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, STACK_PRESS_SCALE],
                  }),
            ),
          ),
        },
      ],
    };
  }, [depthAnim, fade, lift, press, reduceMotion, spread, tx, width]);
  const contentOpacity = useMemo(
    () =>
      reduceMotion
        ? Animated.multiply(
            contentAnim,
            press.interpolate({
              inputRange: [0, 1],
              outputRange: [1, STACK_PRESS_DIM],
            }),
          )
        : contentAnim,
    [contentAnim, press, reduceMotion],
  );

  // A drag that started on the card must not open it when released.
  const pressStart = useRef({ x: 0, y: 0 });
  const dragged = useRef(false);
  const trackStart = useCallback((x: number, y: number) => {
    pressStart.current = { x, y };
    dragged.current = false;
  }, []);
  const trackMove = useCallback((x: number, y: number) => {
    const dx = Math.abs(x - pressStart.current.x);
    const dy = Math.abs(y - pressStart.current.y);
    if (Math.max(dx, dy) > STACK_TAP_SLOP) dragged.current = true;
  }, []);
  const handlePress = useCallback(() => {
    if (dragged.current || !isTop) return;
    onOpen(item);
  }, [isTop, item, onOpen]);

  const onKeyDown = useCallback(
    (event: {
      key: string;
      target: unknown;
      currentTarget: unknown;
      preventDefault: () => void;
    }) => {
      // Keys pressed on Close belong to it.
      if (event.target !== event.currentTarget) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onOpen(item);
      } else if (
        canStep &&
        (event.key === 'ArrowRight' || event.key === 'ArrowLeft')
      ) {
        event.preventDefault();
        onStep(event.key === 'ArrowRight' ? 1 : -1);
      }
    },
    [canStep, item, onOpen, onStep],
  );

  const buttonRef = useCallback(
    (node: unknown) => registerButton(itemId, node),
    [itemId, registerButton],
  );

  const body = (
    <Animated.View
      pointerEvents={isTop && !leaving ? 'auto' : 'none'}
      style={[
        {
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: STACK_CARD_HEIGHT,
          transformOrigin: '50% 100%',
          // A leaving card stays above the one coming forward; steps of two
          // leave room for the rising face between the first two cards.
          zIndex: leaving ? 40 : 20 - 2 * depth,
        },
        cardMotion,
      ]}
      {...responder?.panHandlers}
    >
      <XStack
        testID={isTop ? 'home-wallet-banner-stack-top' : undefined}
        h={STACK_CARD_HEIGHT}
        pl="$3"
        pr={item.closeable ? STACK_CLOSE_PAD : '$4'}
        alignItems="center"
        bg="$bg"
        borderRadius={STACK_CARD_RADIUS}
        borderCurve="continuous"
        // Cards behind show only their edges.
        aria-hidden={isTop ? undefined : true}
        {...(platformEnv.isNative
          ? {
              style: { boxShadow: shadows.rest },
              // The press area, not an accessibility element: the button
              // inside and Close stay reachable on their own.
              accessible: false,
              onTouchStart: (e: GestureResponderEvent) =>
                trackStart(e.nativeEvent.pageX, e.nativeEvent.pageY),
              onTouchMove: (e: GestureResponderEvent) =>
                trackMove(e.nativeEvent.pageX, e.nativeEvent.pageY),
            }
          : ({
              // A class, not an inline style, so the hover shadow can win.
              boxShadow: shadows.rest,
              ...(isTop && {
                hoverStyle: { boxShadow: shadows.hover },
                // A banner, not a link: the plain arrow, as asked for.
                cursor: 'default',
              }),
              transition: 'popoverQuick',
              animateOnly: ANIMATE_ONLY_SHADOW,
              // A mouse drag sends no touch events on web.
              onPointerDown: (e: { clientX: number; clientY: number }) =>
                trackStart(e.clientX, e.clientY),
              onPointerMove: (e: { clientX: number; clientY: number }) =>
                trackMove(e.clientX, e.clientY),
            } as const))}
        onPressIn={pressIn}
        onPressOut={pressOut}
        onPress={handlePress}
        userSelect="none"
      >
        <Animated.View
          pointerEvents={isTop && !leaving ? 'auto' : 'none'}
          style={{
            flex: 1,
            minWidth: 0,
            alignSelf: 'stretch',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            opacity: contentOpacity,
          }}
        >
          {/* The banner's button: the image and words only, reaching back
              over the card's left padding so its focus ring meets the card's
              edge there. */}
          <XStack
            ref={buttonRef}
            flex={1}
            minWidth={0}
            alignSelf="stretch"
            alignItems="center"
            gap="$3"
            ml="$-3"
            pl="$3"
            borderRadius={STACK_CARD_RADIUS}
            role={isTop ? 'button' : undefined}
            aria-label={
              isTop
                ? [item.title, item.description].filter(Boolean).join(', ')
                : undefined
            }
            tabIndex={isTop ? 0 : undefined}
            focusVisibleStyle={{
              outlineColor: '$focusRing',
              outlineWidth: 2,
              outlineStyle: 'solid',
              outlineOffset: -2,
            }}
            onKeyDown={isTop ? onKeyDown : undefined}
            {...(platformEnv.isNative &&
              isTop && {
                accessibilityActions: canStep
                  ? [
                      { name: 'activate' },
                      {
                        name: 'next',
                        label: intl.formatMessage({
                          id: ETranslations.global_next,
                        }),
                      },
                    ]
                  : [{ name: 'activate' }],
                onAccessibilityAction: (event: {
                  nativeEvent: { actionName: string };
                }) => {
                  if (event.nativeEvent.actionName === 'activate') {
                    onOpen(item);
                  } else if (event.nativeEvent.actionName === 'next') {
                    onStep(1);
                  }
                },
              })}
          >
            <StripContent item={item} mediaRadius={STACK_MEDIA_RADIUS} />
          </XStack>
          {item.closeable ? (
            <IconButton
              testID="home-wallet-banner-stack-close"
              variant="tertiary"
              icon="CrossedSmallOutline"
              // The 36 circle reaches 44 under a finger.
              {...(platformEnv.isNative && { hitSlop: 4 })}
              aria-label={intl.formatMessage({
                id: ETranslations.global_close,
              })}
              onPressIn={stopPressIn}
              onPress={(event: GestureResponderEvent) => {
                event.stopPropagation();
                close();
              }}
            />
          ) : null}
        </Animated.View>
      </XStack>
    </Animated.View>
  );

  return STACK_DRAG_WITH_RESPONDER ? (
    body
  ) : (
    <GestureDetector gesture={pan}>{body}</GestureDetector>
  );
}

// Folds the stack band and the gap above it away, on the cards' own move
// (STACK_MOVE_MS, STACK_EASE_MOVE): it is the same stack settling.
// React state drives it a frame at a time, so every frame commits a layout:
// the native home pager places the tabs below from the header's layout, and
// neither a UI-thread nor a JS-driven Animated height reaches that layout on
// every frame. Only this frame re-renders; its children stay the same.
function StackFold({
  folding,
  height,
  onFolded,
  children,
}: {
  folding: boolean;
  height: number;
  onFolded: () => void;
  children: ReactNode;
}) {
  const [progress, setProgress] = useState(1);
  const onFoldedRef = useRef(onFolded);
  useEffect(() => {
    onFoldedRef.current = onFolded;
  }, [onFolded]);
  useEffect(() => {
    if (!folding) return undefined;
    // Timed from the first frame, so the curve's start is not skipped.
    let start: number | undefined;
    let frame = 0;
    const step = (now: number) => {
      start ??= now;
      const t = Math.min(1, (now - start) / STACK_MOVE_MS);
      setProgress(1 - STACK_EASE_MOVE(t));
      if (t < 1) frame = requestAnimationFrame(step);
      else onFoldedRef.current();
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [folding]);
  return (
    <View
      style={
        folding
          ? {
              height: height * progress,
              marginTop: (progress - 1) * STACK_HEADER_GAP,
              overflow: 'hidden',
            }
          : undefined
      }
    >
      {children}
    </View>
  );
}

function BannerStack({
  banners,
  handleBannerOnPress,
  handleDismiss,
  leadingContent,
}: {
  banners: IWalletBanner[];
  handleBannerOnPress: (item: IWalletBanner) => void;
  handleDismiss: (item: IWalletBanner) => void;
  leadingContent?: ReactNode;
}) {
  const shadows = useStackCardShadows();
  const reduceMotion = useReducedMotion();
  const { index, show } = useStripBanner(banners);
  // Front to back, starting with the banner shown.
  const order = useMemo(
    () =>
      banners.length
        ? [...banners.slice(index), ...banners.slice(0, index)]
        : [],
    [banners, index],
  );
  const count = order.length;
  const frontId = order[0]?.id;
  const [width, setWidth] = useState(0);
  const [flyRequest, setFlyRequest] = useState(0);
  const [jump, setJump] = useState(false);
  const [spread] = useState(() => new Animated.Value(0));

  // Each visit shows the next banner as it is, without motion: the cards
  // mount afresh.
  const [visitKey, setVisitKey] = useState(0);
  const homeFocused = useRef(true);
  useListenTabFocusState(ETabRoutes.Home, (isFocus) => {
    if (isFocus && !homeFocused.current) setVisitKey((key) => key + 1);
    homeFocused.current = isFocus;
  });
  // The band keeps its height while banners close during a visit, so nothing
  // below the stack moves; the closed card's edge just leaves room under the
  // stack. The next visit lays the band out for the banners left. It grows
  // at once when banners arrive.
  const depth = Math.min(count, 3);
  const [bandDepth, setBandDepth] = useState({ visitKey, depth });
  let heldDepth = bandDepth.depth;
  if (bandDepth.visitKey !== visitKey || depth > bandDepth.depth) {
    heldDepth = depth;
    setBandDepth({ visitKey, depth });
  }
  const stackHeight = count
    ? STACK_CARD_HEIGHT + STACK_PEEK * (heldDepth - 1)
    : 0;

  // After a keyboard or screen reader pick, focus follows the new front card.
  const buttons = useRef(new Map<string, unknown>());
  const registerButton = useCallback((id: string, node: unknown) => {
    if (node) buttons.current.set(id, node);
    else buttons.current.delete(id);
  }, []);
  const focusFront = useRef(false);
  useEffect(() => {
    if (jump) setJump(false);
    if (!focusFront.current || !frontId) return;
    focusFront.current = false;
    const node = buttons.current.get(frontId);
    if (!node) return;
    if (platformEnv.isNative) {
      AccessibilityInfo.sendAccessibilityEvent(node as HostInstance, 'focus');
    } else {
      (node as HTMLElement).focus?.();
    }
  }, [frontId, jump]);

  const step = useCallback(
    (delta: 1 | -1) => {
      if (count < 2) return;
      focusFront.current = true;
      setJump(true);
      show(order[delta === 1 ? 1 : count - 1].id);
    },
    [count, order, show],
  );

  const nextAfter = useCallback(
    (id: string) => {
      const at = order.findIndex((banner) => banner.id === id);
      return order[(at + 1) % count];
    },
    [count, order],
  );
  // A swipe to the right sends the front card off to the right and brings up
  // the previous banner (the back card): its face rises from the second slot
  // while its own card waits hidden at the front, then takes over.
  const prevItem = count > 1 ? order[count - 1] : undefined;
  const [held, setHeld] = useState<IWalletBanner>();
  const [arrivingId, setArrivingId] = useState<string>();
  const [faceRise] = useState(() => new Animated.Value(1));
  const [faceContent] = useState(() => new Animated.Value(0));
  const bringPrev = useCallback(() => {
    const item = prevItem;
    if (!item) return;
    if (reduceMotion) {
      show(item.id);
      return;
    }
    faceRise.setValue(1);
    faceContent.setValue(0);
    setHeld(item);
    setArrivingId(item.id);
    show(item.id);
    Animated.parallel([
      stackTiming(faceRise, 0, STACK_MOVE_MS, STACK_EASE_MOVE),
      stackTiming(faceContent, 1, STACK_CONTENT_MS, STACK_EASE_OUT),
    ]).start(() => setArrivingId(undefined));
  }, [faceContent, faceRise, prevItem, reduceMotion, show]);
  // The card now shows above its face: let the face go.
  useEffect(() => {
    if (held && !arrivingId) setHeld(undefined);
  }, [arrivingId, held]);

  // Thrown cards: a copy flies off while the card takes its place at once.
  const [ghosts, setGhosts] = useState<
    {
      key: number;
      item: IWalletBanner;
      dir: 1 | -1;
      from: number;
      velocity?: number;
    }[]
  >([]);
  const ghostSeq = useRef(0);
  const [landingId, setLandingId] = useState<string>();
  const onThrow = useCallback(
    (item: IWalletBanner, dir: 1 | -1, from: number, velocity?: number) => {
      ghostSeq.current += 1;
      const key = ghostSeq.current;
      setGhosts((list) => [...list, { key, item, dir, from, velocity }]);
      setLandingId(item.id);
      if (dir > 0) {
        bringPrev();
        return;
      }
      const next = nextAfter(item.id);
      if (next && next.id !== item.id) show(next.id);
    },
    [bringPrev, nextAfter, show],
  );
  const onGhostDone = useCallback((key: number) => {
    setGhosts((list) => list.filter((ghost) => ghost.key !== key));
  }, []);
  // The thrown card has taken its new place (child effects run first).
  useEffect(() => {
    if (landingId) setLandingId(undefined);
  }, [landingId]);

  const onLeave = useCallback(
    (id: string, reason: 'close') => {
      const next = nextAfter(id);
      if (!next || next.id === id) return;
      // Close took keyboard focus with it: hand it to the new front card.
      const active = globalThis.document?.activeElement;
      if (
        reason === 'close' &&
        active &&
        active !== globalThis.document?.body
      ) {
        focusFront.current = true;
      }
      show(next.id);
    },
    [nextAfter, show],
  );
  const onRequestNext = useCallback(() => setFlyRequest((n) => n + 1), []);

  // Closing the last banner folds the band and the gap above it away, then
  // drops it (StackFold).
  const [folding, setFolding] = useState(false);
  const [folded, setFolded] = useState(false);
  const foldItem = useRef<IWalletBanner | undefined>(undefined);
  const endFoldMotion = useRef<(() => void) | undefined>(undefined);
  useEffect(() => () => endFoldMotion.current?.(), []);
  const onFolded = useCallback(() => {
    setFolded(true);
    if (foldItem.current) handleDismiss(foldItem.current);
  }, [handleDismiss]);
  // The header's reserved height follows the banner list, so the motion ends
  // only once the closed banner has left it (or after a second at most);
  // ending it earlier would reopen the header for a frame.
  useEffect(() => {
    if (!folded || !endFoldMotion.current) return undefined;
    const end = () => {
      endFoldMotion.current?.();
      endFoldMotion.current = undefined;
    };
    if (!count) {
      end();
      return undefined;
    }
    const timer = setTimeout(end, 1000);
    return () => clearTimeout(timer);
  }, [count, folded]);
  const onClosed = useCallback(
    (id: string) => {
      const item = order.find((banner) => banner.id === id);
      if (!item) return;
      if (count <= 1 && !leadingContent && !reduceMotion) {
        endFoldMotion.current = beginHomeHeaderMotion();
        foldItem.current = item;
        setFolding(true);
        return;
      }
      handleDismiss(item);
    },
    [count, handleDismiss, leadingContent, order, reduceMotion],
  );

  const part = useCallback(
    (to: 0 | 1) => {
      // A tap on a touch screen also sends mouseenter; the hint is for
      // pointers that can hover.
      if (
        reduceMotion ||
        !globalThis.matchMedia?.('(hover: hover) and (pointer: fine)').matches
      ) {
        return;
      }
      Animated.timing(spread, {
        toValue: to,
        duration: STACK_HOVER_MS,
        easing: STACK_EASE_OUT,
        useNativeDriver: STACK_NATIVE_DRIVER,
      }).start();
    },
    [reduceMotion, spread],
  );

  const cards = count ? (
    <Animated.View
      key={visitKey}
      style={{
        height: stackHeight,
        ...(STACK_DRAG_WITH_RESPONDER && { width }),
      }}
    >
      {order.toReversed().map((item, reversedIndex) => (
        <BannerStackCard
          key={item.id}
          item={item}
          depth={count - 1 - reversedIndex}
          width={width}
          canStep={count > 1}
          jump={jump}
          arriving={item.id === arrivingId}
          landing={item.id === landingId}
          reduceMotion={reduceMotion}
          shadows={shadows}
          spread={spread}
          flyRequest={flyRequest}
          registerButton={registerButton}
          onOpen={handleBannerOnPress}
          onStep={step}
          onThrow={onThrow}
          onLeave={onLeave}
          onClosed={onClosed}
          canPull={!!prevItem && !held}
        />
      ))}
      {held ? (
        <BannerStackFace
          item={held}
          shadow={shadows.rest}
          rise={faceRise}
          content={faceContent}
        />
      ) : null}
      {ghosts.map((ghost) => (
        <BannerStackGhost
          key={ghost.key}
          ghostKey={ghost.key}
          item={ghost.item}
          shadow={shadows.rest}
          dir={ghost.dir}
          from={ghost.from}
          velocity={ghost.velocity}
          width={width}
          reduceMotion={reduceMotion}
          onDone={onGhostDone}
        />
      ))}
      {count > 1 ? (
        // The edges below the front card are scaled cards whose edges lie
        // outside their own frames, where native hit testing does not reach,
        // so a plain strip over them takes the tap. Keyboards use the arrow
        // keys and screen readers the Next action instead.
        <Stack
          testID="home-wallet-banner-stack-next"
          position="absolute"
          left={0}
          right={0}
          top={STACK_CARD_HEIGHT}
          // Web has no hitSlop, so the strip itself reaches down there.
          bottom={platformEnv.isNative ? 0 : -STACK_EDGE_POINTER_SLOP}
          {...(platformEnv.isNative && {
            hitSlop: {
              top: 0,
              left: 0,
              right: 0,
              bottom: STACK_EDGE_TOUCH_SLOP,
            },
          })}
          zIndex={50}
          cursor="default"
          aria-hidden
          onPress={onRequestNext}
        />
      ) : null}
    </Animated.View>
  ) : null;

  if (folded) return null;

  return (
    <StackFold folding={folding} height={stackHeight} onFolded={onFolded}>
      <YStack
        gap="$3"
        bg="$bgApp"
        onLayout={(e) =>
          setWidth(e.nativeEvent.layout.width - 2 * BANNER_PADDING_H)
        }
      >
        {leadingContent ? (
          <Stack px={BANNER_PADDING_H}>{leadingContent}</Stack>
        ) : null}
        {cards && STACK_DRAG_WITH_RESPONDER ? (
          // Room above and below for the shadows and the lift on Close,
          // which the scroll view would otherwise clip.
          <ScrollView
            horizontal
            scrollEnabled={false}
            flexGrow={0}
            my={-8}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ px: BANNER_PADDING_H, py: 8 }}
          >
            {cards}
          </ScrollView>
        ) : null}
        {cards && !STACK_DRAG_WITH_RESPONDER ? (
          <Stack
            px={BANNER_PADDING_H}
            // Tamagui wires hover events only for these (not onHoverIn).
            {...(!platformEnv.isNative && {
              onMouseEnter: () => part(1),
              onMouseLeave: () => part(0),
            })}
          >
            {cards}
          </Stack>
        ) : null}
      </YStack>
    </StackFold>
  );
}

function WalletBanner({ hidden = false }: { hidden?: boolean } = {}) {
  const {
    activeAccount: { account, network, wallet, vaultSettings, indexedAccount },
  } = useActiveAccount({ num: 0 });

  const intl = useIntl();

  const closedBannerInitRef = useRef(false);

  const bannersInitRef = useRef(false);

  const [{ banners }] = useWalletTopBannersAtom();
  const { updateWalletTopBanners } = useAccountOverviewActions().current;

  const { handleBannerOnPress } = useWalletBanner({
    account,
    network,
    wallet,
  });

  // --- Perps Referral Banner ---
  const [referralBannerHiddenForAccounts, setReferralBannerHiddenForAccounts] =
    useState<Record<string, boolean>>({});
  const hideReferralBanner = useCallback((userAddress: string) => {
    setReferralBannerHiddenForAccounts((prev) => ({
      ...prev,
      [userAddress.toLowerCase()]: true,
    }));
  }, []);

  // A global EVM deriveType change resolves a different Arbitrum address under
  // the same account/indexedAccount ids, so it must invalidate the scope too.
  // GlobalDeriveTypeUpdate carries no networkId, so skip the bump only when
  // both the landed result and the latest check's read already use the current
  // Perps deriveType. The store mutates ~100ms before emitting, so a check can
  // read a value no event has reported yet (A→B while A is landed), or a value
  // the store has already reverted (A→B→A, landing B after both events saw A).
  // Either mismatch, or a read still pending, must bump.
  const [perpsDeriveTypeRevision, setPerpsDeriveTypeRevision] = useState(0);
  const landedPerpsDeriveTypeRef = useRef<IAccountDeriveTypes | undefined>(
    undefined,
  );
  // undefined while the latest check's read is pending. A failed read restores
  // the previous value: the run cannot land, so it must not arm every later
  // event with a permanent mismatch.
  const latestReadPerpsDeriveTypeRef = useRef<IAccountDeriveTypes | undefined>(
    undefined,
  );
  const referralCheckIdRef = useRef(0);
  useEffect(() => {
    const syncPerpsDeriveType = async () => {
      // A failed read yields undefined, which invalidates conservatively.
      const deriveType = await backgroundApiProxy.serviceNetwork
        .getGlobalDeriveTypeOfNetwork({ networkId: PERPS_NETWORK_ID })
        .catch(() => undefined);
      if (
        deriveType &&
        deriveType === landedPerpsDeriveTypeRef.current &&
        deriveType === latestReadPerpsDeriveTypeRef.current
      ) {
        return;
      }
      setPerpsDeriveTypeRevision((value) => value + 1);
    };
    const onGlobalDeriveTypeUpdate = () => {
      void syncPerpsDeriveType();
    };
    appEventBus.on(
      EAppEventBusNames.GlobalDeriveTypeUpdate,
      onGlobalDeriveTypeUpdate,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.GlobalDeriveTypeUpdate,
        onGlobalDeriveTypeUpdate,
      );
    };
  }, []);

  const referralAccountScope = `${account?.id ?? ''}:${indexedAccount?.id ?? ''}:${perpsDeriveTypeRevision}`;

  const { result: scopedReferralEligibility } = usePromiseResult(
    async () => {
      if (!account?.id) {
        return null;
      }
      const scope = `${account.id}:${indexedAccount?.id ?? ''}:${perpsDeriveTypeRevision}`;
      referralCheckIdRef.current += 1;
      const checkId = referralCheckIdRef.current;
      const previousReadPerpsDeriveType = latestReadPerpsDeriveTypeRef.current;
      latestReadPerpsDeriveTypeRef.current = undefined;
      // Use the global EVM deriveType for PERPS_NETWORK_ID, not the scene-local
      // deriveType. Home may currently be on a non-EVM network (e.g. BTC with
      // 'native_segwit'), in which case the scene deriveType cannot resolve the
      // Arbitrum account.
      const globalEvmDeriveType = await backgroundApiProxy.serviceNetwork
        .getGlobalDeriveTypeOfNetwork({ networkId: PERPS_NETWORK_ID })
        .catch((error: unknown) => {
          // usePromiseResult neither lands nor retries a rejected run, so a
          // pending marker left behind would make every later
          // GlobalDeriveTypeUpdate bump the scope until the next successful
          // revalidation. Only the run still owning the ref may restore it.
          if (checkId === referralCheckIdRef.current) {
            latestReadPerpsDeriveTypeRef.current = previousReadPerpsDeriveType;
          }
          throw error;
        });
      // usePromiseResult only lands the latest run, so an older read resolving
      // late must not overwrite the newer one.
      if (checkId === referralCheckIdRef.current) {
        latestReadPerpsDeriveTypeRef.current = globalEvmDeriveType;
      }
      const eligibility =
        await backgroundApiProxy.serviceHyperliquidReferral.checkBannerReferralEligibility(
          {
            accountId: account.id,
            indexedAccountId: indexedAccount?.id || undefined,
            deriveType: globalEvmDeriveType,
          },
        );
      return { scope, deriveType: globalEvmDeriveType, eligibility };
    },
    [account?.id, indexedAccount?.id, perpsDeriveTypeRevision],
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    },
  );
  // Keep the last result while a focus/reconnect revalidation is in flight:
  // the eligible path always hits the network (~1s), and clearing the result
  // meanwhile drops the banner and re-inserts it at index 0 on every tab
  // switch. A result from a previous account or deriveType is never shown.
  const landedReferralResult =
    scopedReferralEligibility?.scope === referralAccountScope
      ? scopedReferralEligibility
      : undefined;
  const referralEligibility = landedReferralResult?.eligibility;
  landedPerpsDeriveTypeRef.current = landedReferralResult?.deriveType;

  const referralAccountScopeRef = useRef(referralAccountScope);
  referralAccountScopeRef.current = referralAccountScope;

  useEffect(() => {
    const onBound = ({ userAddress }: { userAddress: string }) =>
      hideReferralBanner(userAddress);
    appEventBus.on(EAppEventBusNames.PerpsReferralBound, onBound);
    return () => {
      appEventBus.off(EAppEventBusNames.PerpsReferralBound, onBound);
    };
  }, [hideReferralBanner]);

  const handleReferralBind = useCallback(async () => {
    // Guard against eligibility flipping mid-signing (race condition).
    if (!referralEligibility?.shouldShow) return;
    if (
      !referralEligibility?.resolvedAddress ||
      !referralEligibility?.resolvedAccountId
    )
      return;
    const { resolvedAccountId, resolvedAddress } = referralEligibility;
    const isCurrentAccount = () =>
      referralAccountScopeRef.current === referralAccountScope;
    if (!isCurrentAccount()) return;
    const handleAlreadyBound = () => {
      hideReferralBanner(resolvedAddress);
      Toast.message({
        title: intl.formatMessage({
          id: ETranslations.perps__referral_already_bound__msg,
        }),
      });
    };

    try {
      const eligibility =
        await backgroundApiProxy.serviceHyperliquidReferral.checkBannerReferralEligibility(
          { accountId: resolvedAccountId, forceRefresh: true },
        );
      if (!isCurrentAccount()) return;
      if (
        eligibility.resolvedAddress &&
        eligibility.resolvedAddress !== resolvedAddress
      ) {
        throw new OneKeyLocalError('Referral account changed');
      }
      if (eligibility.reason === 'already_has_referrer') {
        await backgroundApiProxy.serviceHyperliquidReferral.invalidateBannerCache(
          { userAddress: resolvedAddress },
        );
        handleAlreadyBound();
        return;
      }
      if (
        !eligibility.shouldShow ||
        eligibility.resolvedAddress !== resolvedAddress
      ) {
        throw new OneKeyLocalError(
          'Referral eligibility could not be confirmed',
        );
      }

      const { typedData, action, nonce } =
        await backgroundApiProxy.serviceHyperliquidReferral.buildSetReferrerTypedData(
          { code: HYPERLIQUID_REFERRAL_CODE },
        );

      if (!isCurrentAccount()) return;
      const signatureHex = await backgroundApiProxy.serviceSend.signMessage({
        unsignedMessage: {
          type: EMessageTypesEth.TYPED_DATA_V4,
          message: JSON.stringify(typedData),
          payload: [resolvedAddress, JSON.stringify(typedData)],
        },
        accountId: resolvedAccountId,
        networkId: PERPS_NETWORK_ID,
      });

      if (
        !isCurrentAccount() ||
        !signatureHex ||
        typeof signatureHex !== 'string'
      )
        return;

      const submitResult =
        await backgroundApiProxy.serviceHyperliquidReferral.submitSetReferrerWithSignature(
          { action, nonce, signatureHex },
        );

      if (submitResult.status === 'ok') {
        await backgroundApiProxy.serviceHyperliquidReferral.invalidateBannerCache(
          { userAddress: resolvedAddress },
        );
        if (!isCurrentAccount()) return;
        void backgroundApiProxy.serviceRookieGuide.recordTaskCompleted(
          ERookieTaskType.HYPERLIQUID_REFERRAL,
        );
        hideReferralBanner(resolvedAddress);
        Toast.success({
          title: intl.formatMessage({
            id: ETranslations.perps__fee_discount_activated__msg,
          }),
        });
      }
    } catch (e) {
      const alreadySet = (e as { data?: { referralAlreadySet?: boolean } })
        ?.data?.referralAlreadySet;
      if (alreadySet) {
        const isBound = await backgroundApiProxy.serviceHyperliquidReferral
          .refreshReferralBinding({ userAddress: resolvedAddress })
          .catch(() => false);
        if (!isCurrentAccount()) {
          return;
        }
        if (isBound) {
          handleAlreadyBound();
          return;
        }
      }
      if (!isCurrentAccount()) {
        return;
      }
      errorToastUtils.showToastOfError(e);
      if (!errorToastUtils.wasAutoToastShown(e)) {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.perps__claim_failed__msg,
          }),
        });
      }
      throw e;
    }
  }, [referralEligibility, referralAccountScope, hideReferralBanner, intl]);

  const handleSnoozeReferralBanner = useCallback(async () => {
    if (!referralEligibility?.resolvedAddress) return;
    await backgroundApiProxy.serviceHyperliquidReferral.snoozeReferralBanner({
      userAddress: referralEligibility.resolvedAddress,
    });
    hideReferralBanner(referralEligibility.resolvedAddress);
  }, [referralEligibility, hideReferralBanner]);

  const handleReferralBannerPress = useCallback(() => {
    let snoozed = false;
    Dialog.show({
      icon: 'GiftSolid',
      tone: 'success',
      title: intl.formatMessage({
        id: ETranslations.perps__claim_fee_discount__title,
      }),
      showFooter: false,
      renderContent: (
        <PerpsReferralDialogContent
          onConfirm={handleReferralBind}
          onSnoozeChange={(checked) => {
            snoozed = checked;
          }}
        />
      ),
      onClose: () => {
        if (snoozed) {
          void handleSnoozeReferralBanner();
        }
      },
    });
  }, [handleReferralBind, handleSnoozeReferralBanner, intl]);

  const referralBannerItem: IWalletBanner | null = useMemo(() => {
    if (
      referralBannerHiddenForAccounts[
        referralEligibility?.resolvedAddress ?? ''
      ] ||
      !referralEligibility?.shouldShow
    )
      return null;
    return {
      _id: PERPS_REFERRAL_BANNER_ID,
      id: PERPS_REFERRAL_BANNER_ID,
      title: intl.formatMessage({
        id: ETranslations.perps__claim_fee_discount__title,
      }),
      description: intl.formatMessage({
        id: ETranslations.perps__claim_fee_discount_short__desc,
      }),
      src: '',
      button: '',
      rank: 0,
      closeable: false,
      closeForever: false,
      useSystemBrowser: false,
      theme: 'light',
      position: 'home',
      icon: 'GiftSolid',
    };
  }, [
    referralBannerHiddenForAccounts,
    referralEligibility?.resolvedAddress,
    referralEligibility?.shouldShow,
    intl,
  ]);

  const [closedForeverBanners, setClosedForeverBanners] = useState<
    Record<string, boolean>
  >({});

  const { result: latestBanners } = usePromiseResult(
    async () => {
      if (isNil(account?.id)) {
        return [];
      }
      const resp =
        await backgroundApiProxy.serviceWalletBanner.fetchWalletBanner({
          accountId: account.id,
        });
      bannersInitRef.current = true;
      return resp;
    },
    [account?.id],
    {
      initResult: [],
    },
  );

  usePromiseResult(async () => {
    if (!closedBannerInitRef.current || !bannersInitRef.current) return;

    const filteredBanners = latestBanners.filter((banner) => {
      if (banner.position && banner.position !== 'home') {
        return false;
      }
      if (banner.networkIds && banner.networkIds.length > 0) {
        if (!network?.id || !banner.networkIds.includes(network.id)) {
          return false;
        }
      }
      return !closedForeverBanners[banner.id];
    });
    // Inject Perps referral banner at the beginning
    const allBanners = referralBannerItem
      ? [referralBannerItem, ...filteredBanners]
      : filteredBanners;
    updateWalletTopBanners({
      banners: allBanners,
    });
    await backgroundApiProxy.serviceWalletBanner.updateLocalTopBanners({
      topBanners: filteredBanners,
    });
  }, [
    latestBanners,
    closedForeverBanners,
    updateWalletTopBanners,
    network?.id,
    referralBannerItem,
  ]);

  const handleDismiss = useCallback(async (item: IWalletBanner) => {
    if (item.closeable) {
      closedBanners[item.id] = true;
      setClosedForeverBanners((prev) => ({
        ...prev,
        [item.id]: true,
      }));
      defaultLogger.wallet.walletBanner.walletBannerClicked({
        bannerId: item.id,
        type: 'close',
      });
      if (item.closeForever) {
        await backgroundApiProxy.serviceWalletBanner.updateClosedForeverBanners(
          {
            bannerId: item.id,
            closedForever: true,
          },
        );
      }
    }
  }, []);

  const initLocalBanners = useCallback(async () => {
    const walletBannerRawData =
      await backgroundApiProxy.simpleDb.walletBanner.getRawData();
    const localTopBanners = walletBannerRawData?.topBanners ?? [];
    const localClosedForeverBanners = walletBannerRawData?.closedForever ?? {};
    updateWalletTopBanners({
      banners: localTopBanners,
    });
    closedBannerInitRef.current = true;
    setClosedForeverBanners({
      ...closedBanners,
      ...localClosedForeverBanners,
    });
  }, [updateWalletTopBanners, setClosedForeverBanners]);

  useEffect(() => {
    void initLocalBanners();
  }, [initLocalBanners]);

  const { gtMd } = useMedia();
  const isStripLayout = !platformEnv.isNative && gtMd;
  const stackShadows = useStackCardShadows();
  const reduceMotion = useReducedMotion();

  const tronCard = useMemo(
    () =>
      vaultSettings?.hasResource && account?.id && network?.id ? (
        <ResourceBannerCard
          key={`${account.id}-${network.id}`}
          accountId={account.id}
          networkId={network.id}
          width={TRON_CARD_WIDTH}
          height={STRIP_HEIGHT}
          cardProps={
            isStripLayout
              ? STRIP_RESOURCE_CARD_PROPS
              : {
                  // Above the stacked cards: full width, on their surface.
                  ...STRIP_RESOURCE_CARD_PROPS,
                  w: '100%',
                  borderRadius: STACK_CARD_RADIUS,
                  boxShadow: stackShadows.rest,
                  hoverStyle: { bg: '$bg', boxShadow: stackShadows.hover },
                  // It gives under the finger like the banner cards.
                  pressStyle: {
                    bg: '$bg',
                    boxShadow: stackShadows.rest,
                    scale: reduceMotion ? 1 : STACK_PRESS_SCALE,
                  },
                  animateOnly: ANIMATE_ONLY_STRIP_CARD,
                  '$platform-native': { borderWidth: 0 },
                }
          }
        />
      ) : null,
    [
      vaultSettings?.hasResource,
      account?.id,
      network?.id,
      isStripLayout,
      stackShadows,
      reduceMotion,
    ],
  );

  const { isBotWallet, isBotWalletDeactivated } = useBotWalletDeactivatedStatus(
    {
      walletId: wallet?.id,
    },
  );
  const isBotWalletReceiveBlocked = shouldBlockBotWalletReceive({
    isBotWallet,
    isBotWalletDeactivated,
  });

  const wrappedHandleBannerOnPress = useCallback(
    (item: IWalletBanner) => {
      if (item.id === PERPS_REFERRAL_BANNER_ID) {
        handleReferralBannerPress();
        return;
      }
      const href = (item.href ?? '').toLowerCase();
      const looksLikeDepositTarget =
        href.includes('receive') ||
        href.includes('deposit') ||
        href.includes('/buy') ||
        href.includes('fund');
      if (isBotWalletReceiveBlocked && looksLikeDepositTarget) {
        Toast.error({
          title: '该钱包已停用，无法接收资产',
        });
        return;
      }
      void handleBannerOnPress(item);
    },
    [handleBannerOnPress, handleReferralBannerPress, isBotWalletReceiveBlocked],
  );

  if (hidden) {
    return null;
  }

  if (banners.length === 0 && !tronCard) {
    return null;
  }

  if (isStripLayout) {
    return (
      <DesktopBannerStrip
        banners={banners}
        handleBannerOnPress={wrappedHandleBannerOnPress}
        handleDismiss={handleDismiss}
        leadingContent={tronCard}
      />
    );
  }

  return (
    <BannerStack
      banners={banners}
      handleBannerOnPress={wrappedHandleBannerOnPress}
      handleDismiss={handleDismiss}
      leadingContent={tronCard}
    />
  );
}

export default WalletBanner;
