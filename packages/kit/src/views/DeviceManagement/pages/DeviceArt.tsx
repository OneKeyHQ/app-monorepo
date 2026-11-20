import { memo, useCallback, useEffect, useState } from 'react';

import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Stack } from '@onekeyhq/components';
import {
  HardwareDevice,
  getHardwareDeviceAspect,
} from '@onekeyhq/components/src/content/HardwareDevice';
import type { IHardwareDeviceType } from '@onekeyhq/components/src/content/HardwareDevice';
import { WalletAvatar } from '@onekeyhq/kit/src/components/WalletAvatar';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IHardwareDeviceColor } from '@onekeyhq/shared/src/utils/hardwareDeviceColors';

// Native draws the screen and keys in code at once but decodes the body's
// bitmap later, so the drawing waits to appear whole. Web shows a cached
// bitmap on its first frame and needs no wait.
const WAITS_FOR_BODY = platformEnv.isNative;
// A drawing that never reports its bitmap still shows.
const BODY_WAIT_LIMIT_MS = 1500;
const FADE_IN = { duration: 150, easing: Easing.out(Easing.cubic) };
const FILL = { flex: 1 } as const;

// The device as drawn for its model, lit on the home screen it idles on.
// Models without a drawing (Trezor, Ledger) keep the wallet avatar.
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

  if (!aspect) {
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
      animation="connecting"
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
