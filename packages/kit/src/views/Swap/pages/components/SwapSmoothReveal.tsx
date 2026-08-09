import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';

import { AnimatePresence, Stack } from '@onekeyhq/components';

const ANIMATE_ONLY_SMOOTH_REVEAL = ['height', 'opacity'] as string[];

/**
 * Expands/collapses `children` smoothly instead of letting them pop in and
 * shove the surrounding layout (OK-58690). The wrapper permanently offsets
 * the parent Stack gap with a negative margin and re-adds it as padding on
 * the inner (measured) node, so the occupied space is driven purely by the
 * animated height: margins are not animatable by the moti driver (they
 * snap), and padding on the animated node itself would clamp its border-box
 * height above 0. Content height is measured via onLayout, so
 * variable-height children (multi-line or stacked alerts) are supported.
 */
export function SwapSmoothReveal({
  visible,
  parentGap = 0,
  children,
}: {
  visible: boolean;
  /**
   * px value of the parent Stack gap to offset ("$3" = 12, "$4" = 16).
   * Leave 0 when the children carry their own spacing (e.g. padding), which
   * is then simply part of the measured height.
   */
  parentGap?: number;
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

  return (
    <AnimatePresence>
      {visible ? (
        <Stack
          key="swapSmoothReveal"
          animation="smooth"
          animateOnly={ANIMATE_ONLY_SMOOTH_REVEAL}
          overflow="hidden"
          mt={-parentGap}
          height={measuredHeight}
          enterStyle={{ height: 0, opacity: 0 }}
          exitStyle={{ height: 0, opacity: 0 }}
        >
          <Stack pt={parentGap} onLayout={onContentLayout}>
            {children}
          </Stack>
        </Stack>
      ) : null}
    </AnimatePresence>
  );
}
