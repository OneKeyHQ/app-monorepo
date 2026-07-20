import { useEffect } from 'react';

import { Stack } from '@onekeyhq/components';

// A "live updating" indicator pinned to the chart's last data point: a solid
// center dot that gently throbs plus an expanding, fading ring that loops
// forever — reads as a heartbeat / breathing pulse. Web/desktop only; mounting/
// unmounting it (via the caller's `pulseLastPoint` flag) starts/stops the loop,
// so a closed market simply does not render it.
//
// Uses native CSS @keyframes (not reanimated): on this desktop build reanimated's
// withRepeat loop settles at its target instead of sweeping, so CSS is the
// reliable driver for a continuous loop on Chromium.
const KEYFRAMES_ID = 'ok-chart-pulse-keyframes';
const RING_KEYFRAME = 'okChartPulseRing';
const DOT_KEYFRAME = 'okChartPulseDot';
const PULSE_DURATION_S = 1.4;
const DOT_SIZE = 8;
const RING_MAX_SCALE = 2.4;
const DOT_THROB_SCALE = 1.3;

function ensurePulseKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(KEYFRAMES_ID)) return;
  const style = document.createElement('style');
  style.id = KEYFRAMES_ID;
  style.textContent = `
    @keyframes ${RING_KEYFRAME} {
      0% { transform: scale(1); opacity: 0.5; }
      100% { transform: scale(${RING_MAX_SCALE}); opacity: 0; }
    }
    @keyframes ${DOT_KEYFRAME} {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(${DOT_THROB_SCALE}); }
    }
  `;
  document.head.appendChild(style);
}

export function LightweightChartPulseDot({
  x,
  y,
  color,
}: {
  x: number;
  y: number;
  color: string;
}) {
  useEffect(() => {
    ensurePulseKeyframes();
  }, []);

  return (
    <Stack
      testID="chart-pulse-dot"
      pointerEvents="none"
      position="absolute"
      left={x - DOT_SIZE / 2}
      top={y - DOT_SIZE / 2}
      width={DOT_SIZE}
      height={DOT_SIZE}
      alignItems="center"
      justifyContent="center"
    >
      <Stack
        testID="chart-pulse-ring"
        pointerEvents="none"
        position="absolute"
        top={0}
        left={0}
        width={DOT_SIZE}
        height={DOT_SIZE}
        borderRadius={DOT_SIZE / 2}
        backgroundColor={color}
        style={{
          animation: `${RING_KEYFRAME} ${PULSE_DURATION_S}s ease-out infinite`,
          willChange: 'transform, opacity',
        }}
      />
      <Stack
        pointerEvents="none"
        width={DOT_SIZE}
        height={DOT_SIZE}
        borderRadius={DOT_SIZE / 2}
        backgroundColor={color}
        style={{
          animation: `${DOT_KEYFRAME} ${PULSE_DURATION_S}s ease-in-out infinite`,
          willChange: 'transform',
        }}
      />
    </Stack>
  );
}
