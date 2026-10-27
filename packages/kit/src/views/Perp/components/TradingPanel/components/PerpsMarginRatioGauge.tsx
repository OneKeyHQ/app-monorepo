import { useId } from 'react';

import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg';

import { useTheme } from '@onekeyhq/components';

function getArcPoint(degrees: number) {
  const angle = (degrees * Math.PI) / 180;
  return {
    x: 22 + 18.5 * Math.cos(angle),
    y: 28 + 18.5 * Math.sin(angle),
  };
}

export function PerpsMarginRatioGauge({ ratio }: { ratio: number }) {
  const theme = useTheme();
  const instanceId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const needleGradientId = `perps-margin-needle-${instanceId}`;
  const arcGradientId = `perps-margin-arc-${instanceId}`;
  if (!Number.isFinite(ratio)) {
    return null;
  }

  const clampedRatio = Math.min(Math.max(ratio, 0), 1);
  // Match the existing 40% and 70% risk thresholds to the colored arc bands.
  let needleAngle: number;
  if (clampedRatio <= 0.4) {
    needleAngle = -65 + (clampedRatio / 0.4) * 30;
  } else if (clampedRatio <= 0.7) {
    needleAngle = -35 + ((clampedRatio - 0.4) / 0.3) * 70;
  } else {
    needleAngle = 35 + ((clampedRatio - 0.7) / 0.3) * 30;
  }
  const startPoint = getArcPoint(160);
  const endPoint = getArcPoint(380);

  return (
    <Svg
      width={16}
      height={13}
      viewBox="-1 5 46 33"
      preserveAspectRatio="xMidYMax meet"
      accessible={false}
      pointerEvents="none"
    >
      <Defs>
        <LinearGradient
          id={arcGradientId}
          gradientUnits="userSpaceOnUse"
          x1={0}
          y1={28}
          x2={44}
          y2={28}
        >
          <Stop offset="0" stopColor="#31BD65" />
          <Stop offset="0.5" stopColor="#FFB117" />
          <Stop offset="1" stopColor="#EB4B6D" />
        </LinearGradient>
        <LinearGradient
          id={needleGradientId}
          gradientUnits="userSpaceOnUse"
          x1={22}
          y1={32}
          x2={22}
          y2={16}
        >
          <Stop offset="0" stopColor="#B9B9B9" />
          <Stop offset="1" stopColor={theme.text.val} />
        </LinearGradient>
      </Defs>
      <Path
        d={`M${startPoint.x} ${startPoint.y}A18.5 18.5 0 1 1 ${endPoint.x} ${endPoint.y}`}
        fill="none"
        stroke={`url(#${arcGradientId})`}
        strokeWidth={7}
      />
      <G transform={`rotate(${needleAngle} 22 32)`}>
        <Path d="M18 32L22 16L26 32Z" fill={`url(#${needleGradientId})`} />
        <Circle cx={22} cy={32} r={4} fill="#B9B9B9" />
      </G>
    </Svg>
  );
}
