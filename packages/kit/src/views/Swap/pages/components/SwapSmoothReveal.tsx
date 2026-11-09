import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { PropsWithChildren, ReactNode } from 'react';

import { AnimatePresence, Stack } from '@onekeyhq/components';
import type { IElement } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { LayoutChangeEvent } from 'react-native';

const ANIMATE_ONLY_SMOOTH_REVEAL = ['height', 'opacity'] as string[];

type IRevealSnapshot = { scope: string; height: number; visible: boolean };
const RevealSnapshotContext = createContext<Map<
  string,
  IRevealSnapshot
> | null>(null);

export function SwapRevealSnapshotProvider({ children }: PropsWithChildren) {
  const snapshots = useRef(new Map<string, IRevealSnapshot>());
  return (
    <RevealSnapshotContext.Provider value={snapshots.current}>
      {children}
    </RevealSnapshotContext.Provider>
  );
}

// Native only: under Yoga a normal-flow child of the height-0 animated wrapper
// measures 0, so onLayout would report 0 forever and the content could never
// expand. Taking the measured node out of flow frees it from that constraint.
// Web/desktop measure the child's natural height fine, and keeping it in flow
// there preserves the intrinsic sizing every SwapSmoothReveal caller relies on.
// (OK-58326)
const MEASURED_CONTENT_LAYOUT_PROPS = platformEnv.isNative
  ? ({ position: 'absolute', left: 0, right: 0, top: 0 } as const)
  : ({} as const);

/**
 * Expands/collapses `children` smoothly instead of letting them pop in and
 * shove the surrounding layout (OK-58690). The wrapper permanently offsets
 * the parent Stack gap with a negative margin and re-adds it as padding on
 * the inner (measured) node, so the occupied space is driven purely by the
 * animated height: margins are not animatable by the moti driver (they
 * snap), and padding on the animated node itself would clamp its border-box
 * height above 0. On native the measurement node is additionally taken out of
 * flow so the wrapper's zero height cannot constrain its onLayout result — see
 * MEASURED_CONTENT_LAYOUT_PROPS. Either way variable-height children
 * (multi-line or stacked alerts) stay measurable.
 */
export function SwapSmoothReveal({
  visible,
  keepMounted = false,
  parentGap = 0,
  gapSide = 'top',
  snapshotKey,
  snapshotScope,
  snapshotPending = false,
  children,
}: {
  visible: boolean;
  /** Keep the measured node mounted so frequent visibility changes animate in place. */
  keepMounted?: boolean;
  /**
   * px value of the parent Stack gap to offset ("$3" = 12, "$4" = 16).
   * Leave 0 when the children carry their own spacing (e.g. padding), which
   * is then simply part of the measured height.
   */
  parentGap?: number;
  /**
   * Which edge of the wrapper faces the parent gap being offset: 'top' when
   * a sibling sits above the revealed content, 'bottom' when below.
   */
  gapSide?: 'top' | 'bottom';
  /** Opt in to restoring measured layout after the surrounding tab remounts. */
  snapshotKey?: string;
  snapshotScope?: string;
  snapshotPending?: boolean;
  children: ReactNode;
}) {
  const snapshots = useContext(RevealSnapshotContext);
  const measuredContentRef = useRef<IElement>(null);
  const [initialSnapshot] = useState(() => {
    const snapshot =
      snapshotKey && snapshotScope ? snapshots?.get(snapshotKey) : undefined;
    return visible && snapshot?.visible && snapshot.scope === snapshotScope
      ? snapshot
      : undefined;
  });
  const [measuredHeight, setMeasuredHeight] = useState(
    initialSnapshot?.height ?? 0,
  );
  const [skipInitialEnter, setSkipInitialEnter] = useState(
    Boolean(initialSnapshot),
  );
  const [suppressTransition, setSuppressTransition] = useState(
    Boolean(initialSnapshot),
  );
  const hasSettledRef = useRef(Boolean(initialSnapshot));
  const snapshot =
    snapshotKey && snapshotScope ? snapshots?.get(snapshotKey) : undefined;
  const restoreSnapshot =
    !hasSettledRef.current &&
    visible &&
    snapshot?.visible &&
    snapshot.scope === snapshotScope
      ? snapshot
      : undefined;

  useLayoutEffect(() => {
    if (restoreSnapshot) {
      setMeasuredHeight(restoreSnapshot.height);
      setSkipInitialEnter(true);
      setSuppressTransition(true);
      hasSettledRef.current = true;
    } else if (!snapshotPending && snapshotScope) {
      hasSettledRef.current = true;
    }
  }, [restoreSnapshot, snapshotPending, snapshotScope]);

  useEffect(() => {
    if (!suppressTransition) return;
    const frame = requestAnimationFrame(() => setSuppressTransition(false));
    return () => cancelAnimationFrame(frame);
  }, [suppressTransition]);

  useLayoutEffect(() => {
    if (!snapshots || !snapshotKey || !snapshotScope || snapshotPending) return;
    if (!visible) {
      snapshots.set(snapshotKey, {
        scope: snapshotScope,
        height: measuredHeight,
        visible: false,
      });
      return;
    }
    const content = measuredContentRef.current;
    if (
      platformEnv.isNative ||
      !content ||
      !('getBoundingClientRect' in content)
    ) {
      return;
    }
    const { width, height } = content.getBoundingClientRect();
    if (width > 0 && height > 0) {
      snapshots.set(snapshotKey, {
        scope: snapshotScope,
        height,
        visible: true,
      });
    }
  }, [
    measuredHeight,
    snapshotKey,
    snapshotPending,
    snapshotScope,
    snapshots,
    visible,
  ]);

  useEffect(() => {
    if (!visible && !snapshotPending) {
      setSkipInitialEnter(false);
    }
  }, [snapshotPending, visible]);

  const onContentLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = event?.nativeEvent?.layout?.height;
    if (typeof nextHeight !== 'number' || Number.isNaN(nextHeight)) {
      return;
    }
    // Hidden web tabs report 0 x 0 without a content change. Preserve the
    // measurable height; `visible` still controls actual collapsing.
    if (
      !platformEnv.isNative &&
      event.nativeEvent.layout.width === 0 &&
      nextHeight === 0
    ) {
      return;
    }
    setMeasuredHeight((prev) => (prev === nextHeight ? prev : nextHeight));
  }, []);

  const isGapTop = gapSide === 'top';
  const hidden = keepMounted && !visible;
  return (
    <AnimatePresence>
      {visible || keepMounted ? (
        <Stack
          key="swapSmoothReveal"
          transition={
            suppressTransition || restoreSnapshot ? undefined : 'smooth'
          }
          animateOnly={ANIMATE_ONLY_SMOOTH_REVEAL}
          overflow="hidden"
          mt={isGapTop && parentGap ? -parentGap : undefined}
          mb={!isGapTop && parentGap ? -parentGap : undefined}
          height={hidden ? 0 : (restoreSnapshot?.height ?? measuredHeight)}
          opacity={hidden ? 0 : 1}
          pointerEvents={hidden ? 'none' : undefined}
          aria-hidden={hidden}
          accessibilityElementsHidden={hidden}
          importantForAccessibility={hidden ? 'no-hide-descendants' : undefined}
          {...(platformEnv.isNative ? {} : { inert: hidden })}
          enterStyle={
            skipInitialEnter || restoreSnapshot
              ? undefined
              : { height: 0, opacity: 0 }
          }
          exitStyle={{ height: 0, opacity: 0 }}
        >
          <Stack
            ref={measuredContentRef}
            {...MEASURED_CONTENT_LAYOUT_PROPS}
            pt={isGapTop && parentGap ? parentGap : undefined}
            pb={!isGapTop && parentGap ? parentGap : undefined}
            onLayout={onContentLayout}
          >
            {children}
          </Stack>
        </Stack>
      ) : null}
    </AnimatePresence>
  );
}
