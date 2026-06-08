import { useCallback, useEffect, useRef, useState } from 'react';

import { LayoutAnimation, Platform, UIManager, View } from 'react-native';

import {
  Button,
  Page,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

/**
 * Dev-only stress page to reproduce the Android-only crash
 *   IndexOutOfBoundsException: getChildDrawingOrder() returned invalid index N
 *   (child count is M)
 * thrown from the ReactViewGroup drawing-order verification path.
 *
 * Root cause (Sentry REACT-NATIVE-48W / 4AM): when a ReactViewGroup has children
 * with `zIndex`, RN enables a custom child drawing order cached in
 * ViewGroupDrawingOrderHelper. If zIndex children are added/removed around a draw
 * pass, the cached order array goes stale (an index >= childCount) and the
 * (pre-fix) guard returns the stale, out-of-bounds index instead of rebuilding.
 *
 * This page maximizes that race: several plain RN <View> containers, each
 * holding a set of absolutely-positioned children that ALL carry a `zIndex`,
 * and the set is mutated (mount/unmount + zIndex reshuffle) on every animation
 * frame. On Android, LayoutAnimation defers the actual child removal past the
 * draw, widening the stale-cache window.
 *
 * QA usage:
 *  - Android: on a pre-fix build, "Start" crashes within seconds. On the patched
 *    build it should keep running indefinitely (watch the frame counter climb).
 *  - iOS: the page runs but never crashes (this drawing-order path is
 *    Android-only); it's safe to leave running as a no-op sanity check.
 */

// Number of parallel stress containers — more containers = more churn per frame.
const CONTAINER_COUNT = 6;
// How many children oscillate within each container (2 .. MAX_CHILDREN).
const MAX_CHILDREN = 9;

const PALETTE = [
  '#FF5A5F',
  '#FFB400',
  '#00A699',
  '#007A87',
  '#7B0051',
  '#00D1C1',
  '#8CE071',
  '#FFAA91',
  '#B4A76C',
];

// Enable LayoutAnimation on Android (legacy arch); it defers child removal,
// which widens the race window. No-op / harmless on Fabric and iOS.
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function StressContainer({ seed, frame }: { seed: number; frame: number }) {
  // Oscillate child count and identities every frame so children mount/unmount
  // and their zIndex order reshuffles continuously.
  const n = 2 + ((frame + seed) % (MAX_CHILDREN - 1));
  const children: number[] = [];
  for (let i = 0; i < n; i += 1) {
    children.push((frame * 31 + seed * 17 + i * 7) % 997);
  }

  return (
    <View
      // Plain RN View => ReactViewGroup on native. Children below carry zIndex,
      // so the custom drawing-order helper is engaged.
      style={{
        width: 120,
        height: 120,
        borderWidth: 1,
        borderColor: '#888',
      }}
    >
      {children.map((id, i) => (
        <View
          key={id}
          style={{
            position: 'absolute',
            top: (id * 3) % 90,
            left: (id * 5) % 90,
            width: 28,
            height: 28,
            borderRadius: 4,
            // Every child has a zIndex (reshuffled each frame) -> forces the
            // drawing-order recompute that the bug mishandles.
            zIndex: (id % 13) + 1,
            backgroundColor: PALETTE[(id + i) % PALETTE.length],
          }}
        />
      ))}
    </View>
  );
}

function DevDrawingOrderStress() {
  const [running, setRunning] = useState(false);
  const [frame, setFrame] = useState(0);
  const rafRef = useRef<number | null>(null);
  const frameCounter = useRef(0);

  useEffect(() => {
    if (!running) {
      return;
    }
    let cancelled = false;
    const tick = () => {
      if (cancelled) {
        return;
      }
      frameCounter.current += 1;
      // On Android, schedule a layout animation so the child removals triggered
      // by the setState below are deferred past the current draw pass.
      if (Platform.OS === 'android') {
        try {
          LayoutAnimation.configureNext({
            duration: 16,
            update: { type: LayoutAnimation.Types.linear },
            delete: {
              type: LayoutAnimation.Types.linear,
              property: LayoutAnimation.Properties.opacity,
            },
          });
        } catch {
          // ignore — LayoutAnimation is best-effort here
        }
      }
      setFrame(frameCounter.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [running]);

  const onToggle = useCallback(() => {
    setRunning((v) => !v);
  }, []);

  const onReset = useCallback(() => {
    setRunning(false);
    frameCounter.current = 0;
    setFrame(0);
  }, []);

  return (
    <Page scrollEnabled>
      <Page.Header title="Drawing Order Stress (Android crash repro)" />
      <Page.Body>
        <YStack px="$5" py="$4" gap="$4">
          <SizableText size="$bodyMd" color="$textSubdued">
            Reproduces the Android-only crash
            {
              ' "getChildDrawingOrder() returned invalid index N (child count is'
            }
            {' M)" (Sentry REACT-NATIVE-48W / 4AM). Tap Start: on a pre-fix'}
            {
              ' Android build it crashes within seconds; on the patched build the'
            }
            {
              ' frame counter keeps climbing. On iOS it never crashes (this path'
            }
            {' is Android-only).'}
          </SizableText>

          <XStack gap="$3" ai="center">
            <Button
              variant={running ? 'destructive' : 'primary'}
              onPress={onToggle}
              testID="drawing-order-stress-toggle"
            >
              {running ? 'Stop' : 'Start'}
            </Button>
            <Button
              variant="secondary"
              onPress={onReset}
              testID="drawing-order-stress-reset"
            >
              Reset
            </Button>
            <SizableText
              size="$bodyMdMedium"
              testID="drawing-order-stress-frames"
            >
              frames: {frame}
            </SizableText>
          </XStack>

          <SizableText size="$bodySm" color="$textSubdued">
            platform: {platformEnv.isNativeIOS ? 'iOS' : ''}
            {platformEnv.isNativeAndroid ? 'Android' : ''}
            {!platformEnv.isNative ? 'web/desktop (no native ViewGroup)' : ''}
            {' · containers: '}
            {CONTAINER_COUNT}
            {' · running: '}
            {running ? 'yes' : 'no'}
          </SizableText>

          {/* The stress field. Re-rendered every animation frame while running. */}
          <Stack
            flexWrap="wrap"
            flexDirection="row"
            gap="$2"
            testID="drawing-order-stress-field"
          >
            {Array.from({ length: CONTAINER_COUNT }, (_, i) => (
              <StressContainer
                key={i}
                seed={i * 3 + 1}
                frame={running ? frame : 0}
              />
            ))}
          </Stack>
        </YStack>
      </Page.Body>
    </Page>
  );
}

export default DevDrawingOrderStress;
