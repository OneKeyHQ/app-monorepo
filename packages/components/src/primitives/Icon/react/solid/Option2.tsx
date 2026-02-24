import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgOption2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M21 6h-4.42l-8 14H3v-2h4.42l8-14H21zm0 14h-6v-2h6z" />
  </Svg>
);
export default SvgOption2;
