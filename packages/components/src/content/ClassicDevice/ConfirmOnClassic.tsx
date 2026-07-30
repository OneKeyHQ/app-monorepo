import { ClassicDevice } from '.';

import { Path, Svg } from 'react-native-svg';

import { useConfirmOnClassicAnimation } from './animation';

/**
 * Confirm scene. Scenarios that ask for on-device confirmation are unbounded,
 * so the screen abstracts to skeleton structure: a title pill, two body bars,
 * and literal x / check corner glyphs - the invariants of every confirm
 * screen. All five shapes are pixel-run paths generated on the real 128x64
 * OLED grid (the panel cannot draw sub-pixel, so even the skeleton's corner
 * rounding is quantized), not smooth SVG rounded rects.
 */

const TITLE_D =
  'M35 3h58v1h-58zM33 4h62v1h-62zM33 5h62v1h-62zM32 6h64v1h-64zM32 7h64v1h-64zM32 8h64v1h-64zM32 9h64v1h-64zM33 10h62v1h-62zM33 11h62v1h-62zM35 12h58v1h-58z';
const LINE1_D =
  'M19 23h90v1h-90zM18 24h92v1h-92zM18 25h92v1h-92zM18 26h92v1h-92zM18 27h92v1h-92zM18 28h92v1h-92zM19 29h90v1h-90z';
const LINE2_D =
  'M37 35h54v1h-54zM36 36h56v1h-56zM36 37h56v1h-56zM36 38h56v1h-56zM36 39h56v1h-56zM36 40h56v1h-56zM37 41h54v1h-54z';
const CROSS_D =
  'M5 53h2v1h-2zM12 53h2v1h-2zM5 54h3v1h-3zM11 54h3v1h-3zM6 55h3v1h-3zM10 55h3v1h-3zM7 56h5v1h-5zM8 57h3v1h-3zM7 58h5v1h-5zM6 59h3v1h-3zM10 59h3v1h-3zM5 60h3v1h-3zM11 60h3v1h-3zM5 61h2v1h-2zM12 61h2v1h-2z';
const CHECK_D =
  'M122 53h2v1h-2zM121 54h3v1h-3zM120 55h3v1h-3zM119 56h3v1h-3zM119 57h2v1h-2zM112 58h2v1h-2zM118 58h3v1h-3zM112 59h3v1h-3zM117 59h3v1h-3zM113 60h6v1h-6zM114 61h4v1h-4zM115 62h2v1h-2z';

// Alphas mirror the approved skeleton: title 150/255, body 72/255 (the
// #484848-on-black weight of the original Lottie bars), action glyphs full.
const CONFIRM_SKELETON = (
  <Svg width="100%" height="100%" viewBox="0 0 128 64" fill="none">
    <Path d={TITLE_D} fill="#fff" fillOpacity={0.59} />
    <Path d={LINE1_D} fill="#fff" fillOpacity={0.28} />
    <Path d={LINE2_D} fill="#fff" fillOpacity={0.28} />
    <Path d={CROSS_D} fill="#fff" />
    <Path d={CHECK_D} fill="#fff" />
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
