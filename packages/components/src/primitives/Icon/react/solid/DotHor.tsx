import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDotHor = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M6 14H2v-4h4zm8 0h-4v-4h4zm8-4v4h-4v-4z" />
  </Svg>
);
export default SvgDotHor;
