import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgRainbow = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11.998 6c6.26 0 11.4 4.793 11.951 10.91a1 1 0 0 1-1.992.18C21.498 11.994 17.214 8 11.998 8s-9.5 3.994-9.959 9.09a1 1 0 0 1-1.992-.18C.598 10.793 5.738 6 11.998 6m0 8a4 4 0 0 1 3.773 2.667 1 1 0 0 1-1.886.666 2.002 2.002 0 0 0-3.774 0 1 1 0 1 1-1.885-.666A4 4 0 0 1 11.998 14m0-4a8 8 0 0 1 7.92 6.858 1 1 0 0 1-1.98.284 6.002 6.002 0 0 0-11.88 0 1 1 0 1 1-1.979-.284A8 8 0 0 1 12 10Z" />
  </Svg>
);
export default SvgRainbow;
