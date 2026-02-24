import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDotVer = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M14 18v4h-4v-4zm0-4h-4v-4h4zm0-8h-4V2h4z" />
  </Svg>
);
export default SvgDotVer;
