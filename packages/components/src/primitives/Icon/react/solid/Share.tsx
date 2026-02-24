import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgShare = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4 18h16v2H2V7h2z" />
    <Path d="M21.414 8 16.5 12.914 15.086 11.5l2.5-2.5H13a4 4 0 0 0-4 4v2H7v-2a6 6 0 0 1 6-6h4.586l-2.5-2.5L16.5 3.086z" />
  </Svg>
);
export default SvgShare;
