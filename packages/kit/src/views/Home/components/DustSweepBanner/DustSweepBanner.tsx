import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { ComponentRef, PropsWithChildren } from 'react';

import { useIntl } from 'react-intl';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  IconButton,
  Image,
  SizableText,
  Stack,
  XStack,
  YStack,
  useTheme,
} from '@onekeyhq/components';
import { s } from '@onekeyhq/components/src/utils/scale';
import { useSpotlight } from '@onekeyhq/kit/src/components/Spotlight';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import {
  DustSweepEntryCapabilitiesProvider,
  useActiveAccountDustSweep,
  useDustSweepSupportedNetworkIds,
} from '@onekeyhq/kit/src/views/DustSweep/hooks/useNavigateToDustSweep';
import {
  TAB_BAR_HEIGHT,
  TAB_TOOLBAR_BUTTON_SIZE,
  TAB_TOOLBAR_CONTENT_WIDTH,
  TAB_TOOLBAR_TRAILING_INSET,
} from '@onekeyhq/kit/src/views/Home/pages/homeTabBarMetrics';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';

import { HomeTestIDs } from '../../testIDs';

import { HintLayerHost } from './HintLayerHost';
import { useDustSweepBannerCount } from './useDustSweepBannerCount';

import type { GestureResponderEvent } from 'react-native';

const STRONG_OUT = Easing.bezier(0.32, 0.72, 0, 1);
const MINI_COIN = 16;
const FRAME_PADDING_TOP = 4;
const CARET = 7;
// The caret sits this far in from the bubble's right end.
const CARET_INSET = 20;

// react-native-web passes `position: fixed` through; native types lack it.
const webFixedLayer = {
  position: 'fixed',
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  zIndex: 60,
} as unknown as typeof StyleSheet.absoluteFill;

const styles = StyleSheet.create({
  // The strip's container starts at the page edge (the native header slot, the
  // web list wrapper): the page padding lines it up with the cards above and
  // the token icons. Web rows bleed their hover background past that line.
  frame: {
    marginHorizontal: platformEnv.isNative ? s(20) : 20,
    paddingTop: FRAME_PADDING_TOP,
    paddingBottom: 8,
  },
  convert: {
    flex: 1,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 12,
    paddingRight: 8,
    // Web Pressable adds a hand; the banner keeps the plain arrow.
    cursor: 'auto',
  },
  bubble: { position: 'absolute', transformOrigin: 'top right' },
  caret: {
    width: 0,
    height: 0,
    marginRight: CARET_INSET - CARET,
    borderLeftWidth: CARET,
    borderRightWidth: CARET,
    borderBottomWidth: CARET,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});

// Where the Spot filter button ends, in the hint layer's coordinates.
type IHintAnchor = { centerX: number; bottom: number; layerWidth: number };

// The strip lives in the token list header while the hint floats over the Spot
// page, so the page hands the strip a way to ask for the hint.
const DustSweepHintContext = createContext<(stripTop?: number) => void>(
  () => {},
);

// Hangs under the filter button, its caret pointing up at the button.
function HintBubble({
  anchor,
  onDone,
}: {
  anchor: IHintAnchor;
  onDone: () => void;
}) {
  const intl = useIntl();
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const text = intl.formatMessage({
    id: ETranslations.dust_sweep_find_here_later__msg,
  });
  const opacity = useSharedValue(0);
  const scale = useSharedValue(reducedMotion ? 1 : 0.96);
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
  const close = useCallback(() => {
    opacity.value = withTiming(0, { duration: 150 }, (done) => {
      if (done) runOnJS(onDone)();
    });
  }, [onDone, opacity]);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 180 });
    scale.value = withTiming(1, { duration: 220, easing: STRONG_OUT });
    AccessibilityInfo.announceForAccessibility(text);
    // Long enough to read in every language.
    const timer = setTimeout(close, Math.max(3500, text.length * 70));
    return () => clearTimeout(timer);
  }, [close, opacity, scale, text]);

  return (
    <Animated.View
      style={[
        styles.bubble,
        {
          top: anchor.bottom + 2,
          right: Math.max(8, anchor.layerWidth - anchor.centerX - CARET_INSET),
        },
        style,
      ]}
    >
      <YStack alignItems="flex-end">
        <View
          style={[styles.caret, { borderBottomColor: theme.bgInverse.val }]}
        />
        <Pressable accessibilityRole="button" onPress={close}>
          <Stack
            maxWidth={280}
            px="$3"
            py="$2"
            borderRadius="$3"
            borderCurve="continuous"
            bg="$bgInverse"
          >
            <SizableText size="$bodyMdMedium" color="$textInverse">
              {text}
            </SizableText>
          </Stack>
        </Pressable>
      </YStack>
    </Animated.View>
  );
}

// Finds the filter button once the layer is laid out. Web reads the button's
// DOM box. Native draws the button inside the pager's tab bar, out of reach,
// so the hint uses the bar's geometry: the strip sits right under the bar, so
// the strip's top (from the ✕ press) is the bar's bottom.
function HintLayer({
  stripTop,
  onDone,
}: {
  stripTop?: number;
  onDone: () => void;
}) {
  const layerRef = useRef<ComponentRef<typeof View>>(null);
  const [anchor, setAnchor] = useState<IHintAnchor>();
  const locate = useCallback(() => {
    layerRef.current?.measureInWindow((x, y, width) => {
      if (!width) return;
      if (platformEnv.isNative) {
        if (stripTop === undefined) {
          onDone();
          return;
        }
        setAnchor({
          centerX:
            width - TAB_TOOLBAR_TRAILING_INSET - TAB_TOOLBAR_CONTENT_WIDTH / 2,
          bottom: stripTop - y - (TAB_BAR_HEIGHT - TAB_TOOLBAR_BUTTON_SIZE) / 2,
          layerWidth: width,
        });
        return;
      }
      const button = document.querySelector(
        `[data-testid="${HomeTestIDs.spotFilterButton}"]`,
      );
      if (!button) {
        onDone();
        return;
      }
      const rect = button.getBoundingClientRect();
      setAnchor({
        centerX: rect.left + rect.width / 2 - x,
        bottom: rect.bottom - y,
        layerWidth: width,
      });
    });
  }, [onDone, stripTop]);

  return (
    <HintLayerHost>
      <View
        ref={layerRef}
        collapsable={false}
        pointerEvents="box-none"
        onLayout={locate}
        style={platformEnv.isNative ? StyleSheet.absoluteFill : webFixedLayer}
      >
        {anchor ? <HintBubble anchor={anchor} onDone={onDone} /> : null}
      </View>
    </HintLayerHost>
  );
}

// Wraps the Spot page: renders the hint over it when the strip asks.
export function DustSweepHintScope({ children }: PropsWithChildren) {
  const [request, setRequest] = useState<{ id: number; stripTop?: number }>();
  const show = useCallback((stripTop?: number) => {
    setRequest((current) => ({ id: (current?.id ?? 0) + 1, stripTop }));
  }, []);
  const clear = useCallback(() => setRequest(undefined), []);
  return (
    <DustSweepHintContext.Provider value={show}>
      {children}
      {request ? (
        <HintLayer
          key={request.id}
          stripTop={request.stripTop}
          onDone={clear}
        />
      ) : null}
    </DustSweepHintContext.Provider>
  );
}

// The first three coins being swept, small enough to sit in the line of text.
function MiniCoins({ logos }: { logos: (string | undefined)[] }) {
  return (
    <XStack>
      {logos.slice(0, 3).map((logoURI, index) => (
        <Stack
          key={index}
          ml={index ? -5 : 0}
          zIndex={3 - index}
          p={1.5}
          borderRadius="$full"
          bg="$bgSubdued"
        >
          <Stack
            w={MINI_COIN}
            h={MINI_COIN}
            borderRadius="$full"
            bg="$bgStrong"
            overflow="hidden"
          >
            {logoURI ? (
              <Image
                size={MINI_COIN}
                borderRadius="$full"
                source={{ uri: logoURI }}
                fallback={<Stack w={MINI_COIN} h={MINI_COIN} />}
              />
            ) : null}
          </Stack>
        </Stack>
      ))}
    </XStack>
  );
}

// The whole strip opens Dust sweep; only ✕ closes it, for good on this
// device, and the hint then shows where Dust sweep stays (the filter panel).
function DustSweepStrip({
  count,
  logos,
  onConvert,
  onDismiss,
}: {
  count: number;
  logos: (string | undefined)[];
  onConvert: () => void;
  onDismiss: () => void;
}) {
  const intl = useIntl();
  const reducedMotion = useReducedMotion();
  const showHint = useContext(DustSweepHintContext);
  // The ✕ button's top inside the frame: its wrapper's offset plus its own.
  const closeOffset = useRef({ wrapper: 0, button: 0 });
  const closing = useRef(false);
  const [pressed, setPressed] = useState(false);
  const [closed, setClosed] = useState(false);
  // The strip always owns its height: it follows the content's height so the
  // list's header slot (measured per layout) moves the rows along with it.
  const height = useSharedValue(0);
  const opacity = useSharedValue(reducedMotion ? 1 : 0);
  const style = useAnimatedStyle(() => ({
    height: height.value,
    opacity: opacity.value,
    overflow: 'hidden',
  }));

  const finishClose = useCallback(() => {
    setClosed(true);
    onDismiss();
  }, [onDismiss]);

  const close = useCallback(
    (event: GestureResponderEvent) => {
      const { pageY, locationY } = event.nativeEvent;
      const { wrapper, button } = closeOffset.current;
      showHint(
        platformEnv.isNative
          ? pageY - locationY - (FRAME_PADDING_TOP + wrapper + button)
          : undefined,
      );
      closing.current = true;
      if (reducedMotion) {
        finishClose();
        return;
      }
      opacity.value = withTiming(0, { duration: 140 });
      height.value = withTiming(
        0,
        { duration: 240, easing: STRONG_OUT },
        (done) => {
          if (done) runOnJS(finishClose)();
        },
      );
    },
    [finishClose, height, opacity, reducedMotion, showHint],
  );

  if (closed) return null;
  return (
    <Animated.View style={style}>
      <View
        onLayout={(event) => {
          if (closing.current) return;
          const next = event.nativeEvent.layout.height;
          if (reducedMotion) {
            height.value = next;
            return;
          }
          // Slides in (and follows later size changes) so the rows below move
          // instead of jumping. The first layout can be partial, so each
          // layout animates to the newest height.
          opacity.value = withTiming(1, { duration: 200 });
          height.value = withTiming(next, {
            duration: 240,
            easing: STRONG_OUT,
          });
        }}
        style={styles.frame}
      >
        {/* Two sibling buttons rather than ✕ inside a button: screen readers
            reach both. The strip still reads and presses as one surface. */}
        <XStack
          testID="home-dust-sweep-banner"
          minHeight={44}
          alignItems="center"
          borderRadius="$4"
          borderCurve="continuous"
          bg={pressed ? '$bgActive' : '$bgSubdued'}
          hoverStyle={{ bg: pressed ? '$bgActive' : '$bgHover' }}
        >
          <Pressable
            testID="home-dust-sweep-banner-convert"
            accessibilityRole="button"
            onPress={onConvert}
            onPressIn={() => setPressed(true)}
            onPressOut={() => setPressed(false)}
            style={styles.convert}
          >
            <MiniCoins logos={logos} />
            {/* Web renders the pressable as a <button>, which centers text. */}
            <SizableText
              size="$bodyMd"
              flex={1}
              numberOfLines={1}
              textAlign="left"
            >
              {intl.formatMessage(
                { id: ETranslations.dust_sweep_small_balances_count__title },
                { count },
              )}
            </SizableText>
          </Pressable>
          <Stack
            pr="$3"
            onLayout={(event) => {
              closeOffset.current.wrapper = event.nativeEvent.layout.y;
            }}
          >
            <IconButton
              testID="home-dust-sweep-banner-close"
              size="small"
              variant="tertiary"
              icon="CrossedSmallOutline"
              title={intl.formatMessage({ id: ETranslations.global_close })}
              aria-label={intl.formatMessage({
                id: ETranslations.global_close,
              })}
              // Native: the button, not its icon, takes the touch, so the
              // press location measures from the button's top. (Web anchors
              // from the DOM, and box-only there swallows the click.)
              pointerEvents={platformEnv.isNative ? 'box-only' : undefined}
              onLayout={(event) => {
                closeOffset.current.button = event.nativeEvent.layout.y;
              }}
              onPress={close}
            />
          </Stack>
        </XStack>
      </View>
    </Animated.View>
  );
}

function DustSweepBannerContent() {
  const { isFirstVisit, tourVisited } = useSpotlight(
    ESpotlightTour.homeDustSweepBanner,
  );
  const { canDustSweep, openDustSweep } = useActiveAccountDustSweep();
  const supportedNetworkIds = useDustSweepSupportedNetworkIds();
  const { count, logos } = useDustSweepBannerCount(
    isFirstVisit && canDustSweep ? supportedNetworkIds : undefined,
  );
  const onConvert = useCallback(() => {
    void openDustSweep('homeBanner');
  }, [openDustSweep]);
  const onDismiss = useCallback(() => {
    void tourVisited();
    defaultLogger.dex.dustSweep.dustSweepHomeBannerDismissed({
      tokenCount: count,
    });
  }, [count, tourVisited]);
  if (!isFirstVisit || !canDustSweep || count < 2) return null;
  return (
    <DustSweepStrip
      count={count}
      logos={logos}
      onConvert={onConvert}
      onDismiss={onDismiss}
    />
  );
}

// Offers Dust sweep above the Spot token list until it is closed once.
export function DustSweepBanner() {
  const isRouteFocused = useRouteIsFocused();
  return (
    <DustSweepEntryCapabilitiesProvider isFocused={isRouteFocused}>
      <DustSweepBannerContent />
    </DustSweepEntryCapabilitiesProvider>
  );
}
