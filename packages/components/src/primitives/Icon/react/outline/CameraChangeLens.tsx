import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCameraChangeLens = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4 9h6V7H7.046A7.15 7.15 0 0 1 12 5a7 7 0 0 1 7 7v1h2v-1a9 9 0 0 0-9-9c-2.278 0-4.392.85-6 2.249V3H4zm-1 3a9 9 0 0 0 9 9 9.15 9.15 0 0 0 6.012-2.258V21h2v-6h-6v2h2.942A7.15 7.15 0 0 1 12 19a7 7 0 0 1-7-7v-1H3z" />
    <Path d="M12.01 13a1 1 0 1 0 0-2H12a1 1 0 1 0 0 2z" />
  </Svg>
);
export default SvgCameraChangeLens;
