import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCameraExposure = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M5 19h4v2H3v-6h2zm16 2h-6v-2h4v-4h2zM12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8M9 5H5v4H3V3h6zm12 4h-2V5h-4V3h6z" />
  </Svg>
);
export default SvgCameraExposure;
