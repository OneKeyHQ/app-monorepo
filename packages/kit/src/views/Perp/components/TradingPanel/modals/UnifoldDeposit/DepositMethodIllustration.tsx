import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { useTheme } from '@onekeyhq/components';

export function DepositMethodIllustration({
  variant,
}: {
  variant: 'wallet' | 'address';
}) {
  const theme = useTheme();

  if (variant === 'address') {
    return (
      <Svg
        width={40}
        height={40}
        viewBox="2 2 44 44"
        accessible={false}
        pointerEvents="none"
      >
        <Path
          d="M8 14V8H14M34 8H40V14M40 34V40H34M14 40H8V34"
          fill="none"
          stroke={theme.textInteractive.val}
          strokeWidth={1.9}
          strokeLinecap="butt"
          strokeLinejoin="miter"
        />
        {/* Preserve QrCodeOutline's grid with adjustable strokes for this illustration. */}
        <G
          transform="translate(9 9) scale(1.25)"
          fill="none"
          stroke={theme.iconStrong.val}
          strokeWidth={1.5}
          strokeLinecap="butt"
          strokeLinejoin="miter"
        >
          <Rect x={4} y={4} width={6} height={6} />
          <Rect x={14} y={4} width={6} height={6} />
          <Rect x={4} y={14} width={6} height={6} />
          <Path d="M14 13.25V16H16.75M17 14H21M20.75 18H18V20.75" />
          <Rect
            x={13.25}
            y={19.25}
            width={1.5}
            height={1.5}
            fill={theme.iconStrong.val}
            stroke="none"
          />
        </G>
      </Svg>
    );
  }

  return (
    <Svg
      width={40}
      height={40}
      viewBox="0 0 48 48"
      accessible={false}
      pointerEvents="none"
    >
      <G
        fill="none"
        stroke={theme.iconStrong.val}
        strokeWidth={1.6}
        strokeLinecap="butt"
        strokeLinejoin="miter"
      >
        <Path
          d="M12 17V9Q12 8 13 8H34Q35 8 35 9V17M12 12H35"
          stroke={theme.textInteractive.val}
        />
        <Rect x={7} y={17} width={34} height={23} rx={2} />
        <Path d="M41 25H31Q29 25 29 27V31Q29 33 31 33H41" />
        <Circle
          cx={33}
          cy={29}
          r={1}
          fill={theme.iconStrong.val}
          stroke="none"
        />
      </G>
    </Svg>
  );
}
