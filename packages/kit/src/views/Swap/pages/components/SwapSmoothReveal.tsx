import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';

import { AnimatePresence, Stack } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

const ANIMATE_ONLY_SMOOTH_REVEAL = ['height', 'opacity'] as string[];

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
  parentGap = 0,
  gapSide = 'top',
  children,
}: {
  visible: boolean;
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
  children: ReactNode;
}) {
  const [measuredHeight, setMeasuredHeight] = useState(0);

  const onContentLayout = useCallback(
    (event: { nativeEvent: { layout: { height: number } } }) => {
      const nextHeight = event?.nativeEvent?.layout?.height;
      if (typeof nextHeight !== 'number' || Number.isNaN(nextHeight)) {
        return;
      }
      setMeasuredHeight((prev) => (prev === nextHeight ? prev : nextHeight));
    },
    [],
  );

  const isGapTop = gapSide === 'top';
  return (
    <AnimatePresence>
      {visible ? (
        <Stack
          key="swapSmoothReveal"
          transition="smooth"
          animateOnly={ANIMATE_ONLY_SMOOTH_REVEAL}
          overflow="hidden"
          mt={isGapTop && parentGap ? -parentGap : undefined}
          mb={!isGapTop && parentGap ? -parentGap : undefined}
          height={measuredHeight}
          enterStyle={{ height: 0, opacity: 0 }}
          exitStyle={{ height: 0, opacity: 0 }}
        >
          <Stack
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
