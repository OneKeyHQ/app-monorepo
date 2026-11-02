import { useId } from 'react';

import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';

import { Stack } from '@onekeyhq/components';
import BtcCircle from '@onekeyhq/components/src/primitives/Icon/react/illus/BtcCircle';
import Ethereum from '@onekeyhq/components/src/primitives/Icon/react/illus/Ethereum';

const SEGMENTS = [
  { start: -87, end: 136, color: '#FF9416' },
  { start: 142, end: 194, color: '#A5B4CB' },
  { start: 200, end: 229, color: '#2475FF' },
  { start: 235, end: 240, color: '#00C7D9' },
  { start: 246, end: 250, color: '#45DAB1' },
  { start: 256, end: 267, color: '#59616B' },
];

function ringArc(start: number, end: number) {
  const from = (start * Math.PI) / 180;
  const to = (end * Math.PI) / 180;
  return `M ${115 + 82 * Math.cos(from)} ${135 + 82 * Math.sin(from)} A 82 82 0 ${end - start > 180 ? 1 : 0} 1 ${115 + 82 * Math.cos(to)} ${135 + 82 * Math.sin(to)}`;
}

// Decorative preview only: the ring does not represent the user's balances.
export function WalletPortfolioArtwork({ scale }: { scale: number }) {
  const id = useId();
  return (
    <Stack width={230 * scale} height={363 * scale}>
      <Svg
        testID="portfolio-device-artwork"
        width={230 * scale}
        height={363 * scale}
        viewBox="0 0 230 363"
      >
        <Defs>
          <LinearGradient id={`${id}-frame`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#98999D" />
            <Stop offset="0.18" stopColor="#25272A" />
            <Stop offset="0.48" stopColor="#60646B" />
            <Stop offset="0.7" stopColor="#242528" />
            <Stop offset="1" stopColor="#6C6E72" />
          </LinearGradient>
          <LinearGradient id={`${id}-blue`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#174DCE" />
            <Stop offset="1" stopColor="#091732" />
          </LinearGradient>
          <LinearGradient id={`${id}-purple`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#4634AC" />
            <Stop offset="1" stopColor="#181428" />
          </LinearGradient>
        </Defs>
        <Rect
          x={1}
          y={1}
          width={228}
          height={361}
          rx={44}
          fill="#141517"
          stroke="#57595D"
        />
        <Rect
          x={3}
          y={3}
          width={224}
          height={357}
          rx={42}
          fill="#070809"
          stroke={`url(#${id}-frame)`}
          strokeWidth={3}
        />
        <Rect
          x={8}
          y={8}
          width={214}
          height={347}
          rx={37}
          fill="#050607"
          stroke="#232528"
        />
        {SEGMENTS.map(({ start, end, color }) => (
          <Path
            key={start}
            d={ringArc(start, end)}
            fill="none"
            stroke={color}
            strokeWidth={11}
            strokeLinecap="butt"
          />
        ))}
        <Rect
          x={24}
          y={237}
          width={86}
          height={86}
          rx={15}
          fill={`url(#${id}-blue)`}
        />
        <Rect
          x={120}
          y={237}
          width={86}
          height={86}
          rx={15}
          fill={`url(#${id}-purple)`}
        />
        <Circle cx={42} cy={258} r={6} fill="#C7DBFF" />
        <Path
          d="M42 262v10m0-4h5"
          stroke="#C7DBFF"
          strokeWidth={3}
          strokeLinecap="round"
        />
        <Path
          d="M143 251v17m-6-6 6 6 6-6"
          fill="none"
          stroke="#D8CCFF"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Rect x={35} y={284} width={42} height={3} rx={1.5} fill="#89A4DC" />
        <Rect x={35} y={292} width={27} height={3} rx={1.5} fill="#627DAD" />
        <Rect x={134} y={284} width={42} height={3} rx={1.5} fill="#9A8DC7" />
      </Svg>
      <Stack position="absolute" left={71 * scale} top={121 * scale}>
        <BtcCircle width={28 * scale} height={28 * scale} />
      </Stack>
      <Stack
        position="absolute"
        left={93 * scale}
        top={121 * scale}
        width={28 * scale}
        height={28 * scale}
        borderRadius={14 * scale}
        bg="#E5E5E7"
        alignItems="center"
        justifyContent="center"
      >
        <Ethereum width={32 * scale} height={32 * scale} />
      </Stack>
      <Stack position="absolute" left={115 * scale} top={121 * scale}>
        <Svg width={50 * scale} height={28 * scale} viewBox="0 0 50 28">
          <Circle cx={14} cy={14} r={14} fill="#2775CA" />
          <Path
            d="M17 9c-1-2-6-2-6 1 0 3 6 2 6 5 0 3-5 4-7 1m4-10v2m0 10v2M8 6a10 10 0 0 0 0 16M20 6a10 10 0 0 1 0 16"
            fill="none"
            stroke="white"
            strokeWidth={1.4}
            strokeLinecap="round"
          />
          <Circle cx={36} cy={14} r={14} fill="#222427" />
          {[30, 36, 42].map((x) => (
            <Circle key={x} cx={x} cy={14} r={1.6} fill="white" />
          ))}
        </Svg>
      </Stack>
    </Stack>
  );
}
