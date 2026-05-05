import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDivider = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M6 20H2v-2h4zm8 0h-4v-2h4zm8 0h-4v-2h4zm0-7H2v-2h20zM6 6H2V4h4zm8 0h-4V4h4zm8 0h-4V4h4z" />
  </Svg>
);
export default SvgDivider;
