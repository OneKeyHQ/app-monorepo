import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCameraChangeLens = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M21 12a9 9 0 0 0-9-9 9.15 9.15 0 0 0-6 2.244V3H4v6h6V7H7.043A7.15 7.15 0 0 1 12 5a7 7 0 0 1 7 7v1h2zm-.988 3h-6v2h2.945A7.15 7.15 0 0 1 12 19a7 7 0 0 1-7-7v-1H3v1a9 9 0 0 0 9 9 9.15 9.15 0 0 0 6.012-2.255V21h2z" />
    <Path d="M12.01 13a1 1 0 1 0 0-2H12a1 1 0 1 0 0 2z" />
  </Svg>
);
export default SvgCameraChangeLens;
