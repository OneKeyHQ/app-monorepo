import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPlaceholder = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M5 19h2v2H3v-4h2zm9.5 2h-5v-2h5zm6.5 0h-4v-2h2v-2h2zM5 14.5H3v-5h2zm16 0h-2v-5h2zM7 5H5v2H3V3h4zm14 2h-2V5h-2V3h4zm-6.5-2h-5V3h5z" />
  </Svg>
);
export default SvgPlaceholder;
