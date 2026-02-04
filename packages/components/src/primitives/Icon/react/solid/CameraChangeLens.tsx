import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCameraChangeLens = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4 20v-4a1 1 0 0 1 1-1h4a1 1 0 1 1 0 2H7.046A7.15 7.15 0 0 0 12 19a7 7 0 0 0 7-7 1 1 0 1 1 2 0 9 9 0 0 1-9 9 9.15 9.15 0 0 1-6-2.249V20a1 1 0 1 1-2 0m-1-8a9 9 0 0 1 9-9c2.283 0 4.402.853 6.012 2.258V4a1 1 0 0 1 2 0v4a1 1 0 0 1-1 1h-4a1 1 0 0 1 0-2h1.942A7.15 7.15 0 0 0 12 5a7 7 0 0 0-7 7 1 1 0 1 1-2 0m9.01-1a1 1 0 1 1 0 2H12a1 1 0 1 1 0-2z" />
  </Svg>
);
export default SvgCameraChangeLens;
