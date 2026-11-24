import { memo, useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { EDeviceType } from '@onekeyfe/hd-shared';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Image, Stack } from '@onekeyhq/components';
import {
  HardwareDevice,
  getHardwareDeviceAspect,
} from '@onekeyhq/components/src/content/HardwareDevice';
import type { IHardwareDeviceType } from '@onekeyhq/components/src/content/HardwareDevice';
import { WalletAvatar } from '@onekeyhq/kit/src/components/WalletAvatar';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { HwWalletAvatarImages } from '@onekeyhq/shared/src/utils/avatarUtils';
import type { IHardwareDeviceColor } from '@onekeyhq/shared/src/utils/hardwareDeviceColors';

// Native draws the screen and keys in code at once but decodes the body's
// bitmap later, so the drawing waits to appear whole. Web shows a cached
// bitmap on its first frame and needs no wait.
const WAITS_FOR_BODY = platformEnv.isNative;
// A drawing that never reports its bitmap still shows.
const BODY_WAIT_LIMIT_MS = 1500;
const FADE_IN = { duration: 150, easing: Easing.out(Easing.cubic) };
const FILL = { flex: 1 } as const;
const WHITE_PRO_AVATAR = `${EDeviceType.Pro}White`;

// The touchscreen models whose idle scene is a home screen mock-up show their
// finish's factory wallpaper instead, so two of them in different finishes
// read apart. Until design exports the images, the wallpaper is the screen of
// the finish's avatar art: a 300px canvas with the screen at x 79-224,
// y 25-275, scaled to cover the 288x484 screen canvas.
const SCREEN_W = 288;
const SCREEN_H = 484;
const AVATAR_CANVAS = 300;
const AVATAR_SCREEN = { left: 79, top: 25, width: 145, height: 250 };
const WALLPAPER_SCALE = Math.max(
  SCREEN_W / AVATAR_SCREEN.width,
  SCREEN_H / AVATAR_SCREEN.height,
);
const wallpaperScreens = new Map<string, ReactNode>();

function getWallpaperScreen(
  deviceType: IHardwareDeviceType | undefined,
  color: IHardwareDeviceColor | undefined,
): ReactNode {
  if (deviceType !== 'pro2' && deviceType !== 'neo') return undefined;
  const finishKey = `${deviceType}${color ?? ''}`;
  // The bare model key is the model's default finish, as the drawing's.
  const key =
    finishKey in HwWalletAvatarImages
      ? (finishKey as keyof typeof HwWalletAvatarImages)
      : deviceType;
  let screen = wallpaperScreens.get(key);
  if (!screen) {
    screen = (
      <Stack w={SCREEN_W} h={SCREEN_H} overflow="hidden">
        <Image
          source={HwWalletAvatarImages[key]}
          position="absolute"
          w={AVATAR_CANVAS * WALLPAPER_SCALE}
          h={AVATAR_CANVAS * WALLPAPER_SCALE}
          left={-AVATAR_SCREEN.left * WALLPAPER_SCALE}
          top={
            -AVATAR_SCREEN.top * WALLPAPER_SCALE -
            (AVATAR_SCREEN.height * WALLPAPER_SCALE - SCREEN_H) / 2
          }
        />
      </Stack>
    );
    wallpaperScreens.set(key, screen);
  }
  return screen;
}

// The device as drawn for its model, lit on the home screen it idles on.
// Models without a drawing (Trezor, Ledger) keep the wallet avatar, and so
// does the white Pro: its drawing only comes in black.
function DeviceArtView({
  deviceType,
  color,
  wallet,
  height,
}: {
  deviceType: IHardwareDeviceType | undefined;
  color: IHardwareDeviceColor | undefined;
  wallet: IDBWallet | undefined;
  height: number;
}) {
  const aspect = getHardwareDeviceAspect(deviceType);
  const reducedMotion = useReducedMotion();
  // Which drawing has its body on screen; another model or finish waits
  // for its own.
  const drawing = `${deviceType ?? ''}|${color ?? ''}`;
  const [wholeDrawing, setWholeDrawing] = useState<string>();
  const showWhole = useCallback(() => setWholeDrawing(drawing), [drawing]);
  const visible = !WAITS_FOR_BODY || wholeDrawing === drawing;
  useEffect(() => {
    if (visible || !aspect) return undefined;
    const timer = setTimeout(showWhole, BODY_WAIT_LIMIT_MS);
    return () => clearTimeout(timer);
  }, [aspect, showWhole, visible]);
  const opacity = useSharedValue(visible ? 1 : 0);
  useEffect(() => {
    if (!visible) {
      opacity.value = 0;
      return;
    }
    opacity.value = reducedMotion ? 1 : withTiming(1, FADE_IN);
  }, [opacity, reducedMotion, visible]);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const wallpaperScreen = getWallpaperScreen(deviceType, color);

  if (!aspect || wallet?.avatarInfo?.img === WHITE_PRO_AVATAR) {
    return <WalletAvatar size={height} wallet={wallet} status="default" />;
  }
  const width = Math.round(height / aspect);
  const art = (
    <HardwareDevice
      deviceType={deviceType}
      color={color}
      width={width}
      // The scene that shows the idle home screen; arriving already lit
      // keeps a wake-up from reading as the device connecting.
      animation={wallpaperScreen ? undefined : 'connecting'}
      screenContent={wallpaperScreen}
      instantEntry
      shadow
      onChromeLoad={WAITS_FOR_BODY ? showWhole : undefined}
    />
  );
  return (
    <Stack w={width} h={height} flexShrink={0} pointerEvents="none" aria-hidden>
      {WAITS_FOR_BODY ? (
        <Animated.View style={[FILL, fadeStyle]}>{art}</Animated.View>
      ) : (
        art
      )}
    </Stack>
  );
}

// Cards re-render on hover and press; the drawing itself has not changed.
export const DeviceArt = memo(DeviceArtView);
