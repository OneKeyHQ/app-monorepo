import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDotGrid = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M7 21H3v-4h4zm7 0h-4v-4h4zm7 0h-4v-4h4zM7 14H3v-4h4zm7 0h-4v-4h4zm7 0h-4v-4h4zM7 7H3V3h4zm7 0h-4V3h4zm7 0h-4V3h4z" />
  </Svg>
);
export default SvgDotGrid;
