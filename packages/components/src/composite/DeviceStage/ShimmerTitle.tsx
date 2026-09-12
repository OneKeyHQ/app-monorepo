import { useMemo } from 'react';
import type { CSSProperties } from 'react';

import { useReducedMotion } from 'react-native-reanimated';

import { useTheme } from '../../hooks/useStyle';
import { SizableText, Stack } from '../../primitives';

/**
 * The capsule's live title on web: the native sibling's sweep — a bright
 * band traveling through dimmed glyphs — spoken in CSS. No masked view
 * here; background-clip: text is the same trick from the other side (the
 * words clip a gradient painted behind them) and one injected keyframe
 * slides the gradient through. Motion lives in the stylesheet; colors
 * stay inline, off the live theme. Under reduced motion the sweep stands
 * down and the words simply show.
 */

const SWEEP_CLASS = 'onekey-device-stage-shimmer';
const SWEEP_KEYFRAMES = 'onekey-device-stage-shimmer-sweep';
/** One full sweep across the words — the native sibling's cadence. */
const SWEEP_MS = 1400;
/** The band parked fully off the words' left edge — the resting frame,
 * and the paused state's whole look (plain dim ink). */
const BAND_PARKED = '150% 0';

// Injected once at import; this module only ever loads in web bundles
// (the native file shadows it), the guard covers node-side renders.
if (typeof document !== 'undefined') {
  const tag = document.createElement('style');
  tag.textContent = `
@keyframes ${SWEEP_KEYFRAMES} {
  from { background-position: ${BAND_PARKED}; }
  to { background-position: -50% 0; }
}
.${SWEEP_CLASS} {
  animation: ${SWEEP_KEYFRAMES} ${SWEEP_MS}ms ease-in-out infinite;
}
`;
  document.head.appendChild(tag);
}

export function ShimmerTitle({
  children,
  paused,
}: {
  children: string;
  /** The sweep stands down (band parked off the words) while the title
   * is mounted but hidden; clearing it restarts the sweep from the left. */
  paused?: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const theme = useTheme();
  const ink = theme.textSubdued.val;
  const sweepStyle = useMemo<CSSProperties>(
    () => ({
      backgroundImage: `linear-gradient(90deg, ${ink} 0%, ${ink} 40%, #FFFFFF 50%, ${ink} 60%, ${ink} 100%)`,
      backgroundSize: '200% 100%',
      backgroundPosition: BAND_PARKED,
      backgroundClip: 'text',
      WebkitBackgroundClip: 'text',
    }),
    [ink],
  );
  if (reducedMotion) {
    return (
      <SizableText size="$headingMd" color="$textSubdued">
        {children}
      </SizableText>
    );
  }
  return (
    <Stack className={paused ? undefined : SWEEP_CLASS} style={sweepStyle}>
      <SizableText size="$headingMd" color="transparent">
        {children}
      </SizableText>
    </Stack>
  );
}
