import type { ComponentProps, PropsWithChildren } from 'react';

import Animated, {
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';

import {
  GlassHeaderProvider,
  GlassView,
  Stack,
  XStack,
  isLiquidGlassAvailable,
  useThemeName,
} from '@onekeyhq/components';
import type { IXStackProps } from '@onekeyhq/components';

import { BROWSER_CHROME_CAPSULE_HEIGHT } from '../../config/Animation.constants';
import { usePageBottomColor } from '../../utils/pageThemeColor';

import type { StyleProp, ViewStyle } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

export const PILL_RADIUS = 9999;

// The page's color at the bottom of the viewport, right above the bottom
// bar: it fills the area under the bar (the iPhone page backdrop, else the
// bar's strip), so the page seems to carry on behind it. Subscribes on its
// own, so color reports only re-render this fill.
export function PageBottomColorFill({
  tabId,
  style,
}: {
  tabId: string | null | undefined;
  style: StyleProp<ViewStyle>;
}) {
  const bottomColor = usePageBottomColor(tabId);
  return (
    <Stack
      bg="$bgApp"
      style={[
        style,
        bottomColor ? { backgroundColor: bottomColor } : undefined,
      ]}
    />
  );
}

// How a capsule fades in over `range` of `progress`.
export interface ICapsuleFade {
  progress: SharedValue<number>;
  range: [number, number];
}

// How far along its fade a capsule is: 0 hidden, 1 shown.
function getFadeAmount(progress: number, [start, end]: [number, number]) {
  'worklet';

  return interpolate(progress, [start, end], [0, 1], 'clamp');
}

// Opacity of a capsule's contents along its fade. Callers that fade some
// children differently (the address capsule's domain) apply it per child.
export function useCapsuleFadeStyle(fade: ICapsuleFade | undefined) {
  const progress = fade?.progress;
  const range = fade?.range;
  return useAnimatedStyle(
    () => ({
      opacity: progress && range ? getFadeAmount(progress.value, range) : 1,
    }),
    [progress, range],
  );
}

// A glass capsule shrinks to this along its fade (contents fading too), like
// Telegram's toolbar glass, rather than switching its glass off: the glass
// draws into a point instead of vanishing mid-morph, and nothing switches
// on the JS thread while a finger scrubs the chrome back and forth.
const GLASS_COLLAPSED_SCALE = 0.001;

function useCapsuleShrinkStyle(fade: ICapsuleFade | undefined) {
  const progress = fade?.progress;
  const range = fade?.range;
  return useAnimatedStyle(() => {
    if (!progress || !range) {
      return {};
    }
    const amount = getFadeAmount(progress.value, range);
    return {
      transform: [{ scale: Math.max(amount, GLASS_COLLAPSED_SCALE) }],
    };
  }, [progress, range]);
}

// Browser chrome glass, with Telegram's panel tint: a faint white, so icons
// and text keep their contrast over busy page content passing behind it.
// Not in the shared GlassView, which would tint glass across the app.
export function ChromeGlassView(props: ComponentProps<typeof GlassView>) {
  const tintColor =
    useThemeName() === 'dark'
      ? 'rgba(255,255,255,0.025)'
      : 'rgba(255,255,255,0.1)';
  return <GlassView tintColor={tintColor} {...props} />;
}

type IBrowserChromeCapsuleProps = PropsWithChildren<{
  flex?: number;
  height?: number;
  px?: IXStackProps['px'];
  fade?: ICapsuleFade;
  // Off for contents laid over a background drawn elsewhere (the bar's
  // morphing address background); `fade` is ignored then.
  background?: boolean;
  // Defaults to a full pill; a chip hosting a square-ish item (the account
  // avatar) uses a concentric radius instead.
  borderRadius?: number;
  // The edge a glass capsule shrinks into along its fade (default: its
  // center). Header capsules shrink outwards, into their screen corners,
  // like Telegram's navigation bar items.
  shrinkTowards?: 'left' | 'right';
}>;

// A pill (or circle, with a single child) hosting browser chrome buttons.
// iOS 26: Liquid Glass. Elsewhere: a solid filled pill (the bar sits on the
// page-colored strip below the WebView, so there's nothing to blur).
// GlassHeaderProvider makes inner IconButtons drop their own background and
// tertiary negative margin, so icons center inside the pill in both cases.
//
// A glass capsule is never faded with opacity: glass under an ancestor whose
// opacity animates to 0 stops rendering and can leave later glass broken
// (expo/expo#50097, #41024, #51575). Its glass shrinks away instead (a
// transform, see GLASS_COLLAPSED_SCALE) and its contents fade on their own.
export function BrowserChromeCapsule({
  children,
  flex,
  height = BROWSER_CHROME_CAPSULE_HEIGHT,
  px = '$1',
  fade,
  background = true,
  borderRadius = PILL_RADIUS,
  shrinkTowards,
}: IBrowserChromeCapsuleProps) {
  const isGlass = isLiquidGlassAvailable();
  const fadeStyle = useCapsuleFadeStyle(fade);
  const shrinkStyle = useCapsuleShrinkStyle(isGlass ? fade : undefined);
  const row = (
    <XStack
      h={height}
      minWidth={height}
      px={px}
      gap="$1"
      alignItems="center"
      justifyContent="center"
    >
      {children}
    </XStack>
  );
  if (!background) {
    return (
      <Stack flex={flex}>
        <GlassHeaderProvider>{row}</GlassHeaderProvider>
      </Stack>
    );
  }
  if (isGlass) {
    const glass = (
      <ChromeGlassView isInteractive style={{ borderRadius, flex }}>
        <GlassHeaderProvider>
          {fade ? <Animated.View style={fadeStyle}>{row}</Animated.View> : row}
        </GlassHeaderProvider>
      </ChromeGlassView>
    );
    return fade ? (
      <Animated.View
        style={[
          { flex },
          shrinkTowards && { transformOrigin: `${shrinkTowards} center` },
          shrinkStyle,
        ]}
      >
        {glass}
      </Animated.View>
    ) : (
      glass
    );
  }
  // No glass here, so the solid pill simply fades as a whole. A column
  // container like GlassView, so the inner row stretches to the capsule's
  // width (as a row child it would shrink to its content, leaving the
  // flexible address area no room).
  return (
    <Animated.View style={[{ flex }, fadeStyle]}>
      <Stack
        flex={flex}
        bg="$bgStrong"
        borderRadius={borderRadius}
        borderCurve="continuous"
      >
        <GlassHeaderProvider>{row}</GlassHeaderProvider>
      </Stack>
    </Animated.View>
  );
}
