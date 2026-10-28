import { createContext, useContext, useMemo, useState } from 'react';

import { useReducedMotion } from 'react-native-reanimated';

import { Stack } from '@onekeyhq/components';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { Token } from '@onekeyhq/kit/src/components/Token';
import type { ITokenProps } from '@onekeyhq/kit/src/components/Token';
import { TOKEN_SIZE_MAP } from '@onekeyhq/kit/src/components/Token/tokenSize';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ANIMATE_ONLY_BG_COLOR } from './earnDesktopColorEase';
import { useEarnDesktopSurfaces } from './useEarnDesktopSurfaces';

import type { IEarnDesktopSurface } from './useEarnDesktopSurfaces';

type IKeyboardEvent = {
  key: string;
  target?: unknown;
  currentTarget?: unknown;
  preventDefault: () => void;
};

/**
 * Tamagui's onPress is a bare click on web: the element takes no tab stop and
 * ignores Enter and Space. These add both, with the app's focus ring. Keys
 * pressed on a button inside the element stay with that button.
 */
export function buildKeyboardPressProps(
  onPress: (() => void) | undefined,
  outlineOffset = 0,
) {
  if (!onPress || !platformEnv.isRuntimeBrowser) {
    return undefined;
  }
  return {
    tabIndex: 0,
    focusVisibleStyle: {
      outlineColor: '$focusRing',
      outlineWidth: 2,
      outlineStyle: 'solid',
      outlineOffset,
    },
    onKeyDown: (event: IKeyboardEvent) => {
      if (event.target !== event.currentTarget) {
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onPress();
      }
    },
  } as const;
}

/**
 * The card color under a pressable surface as it is hovered and pressed. The
 * steps are opaque, so rings drawn in this color around icons stay hidden.
 */
export function usePressableSurface(isPressable: boolean) {
  const surfaces = useEarnDesktopSurfaces();
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  let surface = surfaces.rest;
  if (isPressable && isPressed) {
    surface = surfaces.press;
  } else if (isPressable && isHovered) {
    surface = surfaces.hover;
  }
  const handlers = useMemo(
    () =>
      isPressable
        ? {
            onHoverIn: () => setIsHovered(true),
            onHoverOut: () => {
              setIsHovered(false);
              setIsPressed(false);
            },
            onPressIn: () => setIsPressed(true),
            onPressOut: () => setIsPressed(false),
          }
        : undefined,
    [isPressable],
  );
  return { surface, isActive: surface !== surfaces.rest, handlers };
}

const SurfaceContext = createContext<IEarnDesktopSurface | undefined>(
  undefined,
);

export const EarnDesktopSurfaceProvider = SurfaceContext.Provider;

// The ring eases with the surface under it, which must ease its own color
// the same way (the app's quick fade) for the two to stay one color
const RING_MOTION = {
  transition: 'quick',
  animateOnly: ANIMATE_ONLY_BG_COLOR,
} as const;

/**
 * Token's network badge sits in a ring of the page color, a dark circle on a
 * dark card and a white one on a light card. This one paints the ring in the
 * color of the card or row it sits on.
 */
export function SurfaceToken({
  size = 'md',
  networkId,
  ...rest
}: Omit<ITokenProps, 'showNetworkIcon' | 'cornerBadge'>) {
  const surfaces = useEarnDesktopSurfaces();
  const reduceMotion = useReducedMotion();
  const ringColor = useContext(SurfaceContext) ?? surfaces.rest;
  return (
    <Token
      size={size}
      {...rest}
      showCornerBadgeBorder={false}
      cornerBadge={
        networkId ? (
          <Stack
            p="$0.5"
            bg={ringColor}
            borderRadius="$full"
            {...(reduceMotion ? undefined : RING_MOTION)}
          >
            <NetworkAvatar
              networkId={networkId}
              size={TOKEN_SIZE_MAP[size].chainImageSize}
            />
          </Stack>
        ) : undefined
      }
    />
  );
}
