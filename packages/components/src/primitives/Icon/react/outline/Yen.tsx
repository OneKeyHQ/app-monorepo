import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgYen = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 12a8 8 0 1 0-16 0 8 8 0 0 0 16 0m-9 5v-3h-1a1 1 0 1 1 0-2h.67L7.748 8.658a1 1 0 0 1 1.506-1.316L12 10.48l2.747-3.138a1 1 0 0 1 1.506 1.316L13.329 12H14a1 1 0 1 1 0 2h-1v3a1 1 0 1 1-2 0m11-5c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10" />
  </Svg>
);
export default SvgYen;
