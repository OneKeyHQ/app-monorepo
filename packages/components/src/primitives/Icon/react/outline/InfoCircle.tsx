import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgInfoCircle = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 12a8 8 0 1 0-16 0 8 8 0 0 0 16 0m-9 4v-4a1 1 0 1 1 0-2h1a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0m11-4c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10" />
    <Path d="M12.5 8a.5.5 0 1 0-1 0 .5.5 0 0 0 1 0m.5 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0" />
  </Svg>
);
export default SvgInfoCircle;
