import { ClassicDevice } from '.';

import { Path, Rect, Svg } from 'react-native-svg';

import { useConfirmOnClassicAnimation } from './animation';

/**
 * Confirm scene. Scenarios that ask for on-device confirmation are unbounded,
 * so the screen abstracts to skeleton structure: a title pill, two body bars,
 * and literal x / check corner glyphs - the invariants of every confirm
 * screen. Smooth vector shapes on the 128x64 screen coordinate system (no
 * pixel-grid quantization), so sizes and weights stay one-number tweaks.
 */

const CONFIRM_SKELETON = (
  <Svg width="100%" height="100%" viewBox="0 0 128 64" fill="none">
    <Rect
      x={32}
      y={3}
      width={64}
      height={10}
      rx={5}
      fill="#fff"
      fillOpacity={0.59}
    />
    <Rect
      x={18}
      y={23}
      width={92}
      height={7}
      rx={3.5}
      fill="#fff"
      fillOpacity={0.28}
    />
    <Rect
      x={36}
      y={35}
      width={56}
      height={7}
      rx={3.5}
      fill="#fff"
      fillOpacity={0.28}
    />
    <Path
      d="M6.5 53.5L12.5 59.5M12.5 53.5L6.5 59.5"
      stroke="#fff"
      strokeWidth={1.8}
      strokeLinecap="round"
    />
    <Path
      d="M113.5 57L116.4 59.8L121.5 53.6"
      stroke="#fff"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export interface IConfirmOnClassicProps {
  /** Same contract as ClassicDevice: rendered width in points. */
  width?: number;
}

export function ConfirmOnClassic({ width }: IConfirmOnClassicProps) {
  const animation = useConfirmOnClassicAnimation();
  return (
    <ClassicDevice
      width={width}
      animation={animation}
      screenContent={CONFIRM_SKELETON}
    />
  );
}
