import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCameraExposureFlash = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M5 19h4v2H3v-6h2zm16 2h-6v-2h4v-4h2zM13.378 7.682 11.304 11h5l-3.986 6.378-1.696-1.06L12.696 13h-5l3.986-6.378zM9 5H5v4H3V3h6zm12 4h-2V5h-4V3h6z" />
  </Svg>
);
export default SvgCameraExposureFlash;
