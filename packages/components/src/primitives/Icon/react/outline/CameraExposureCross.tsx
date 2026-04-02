import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCameraExposureCross = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M5 19h4v2H3v-6h2zm16 2h-6v-2h4v-4h2zM15.535 9.879 13.415 12l2.12 2.121-1.414 1.414L12 13.415l-2.121 2.12-1.414-1.414L10.585 12l-2.12-2.121 1.414-1.414L12 10.585l2.121-2.12zM9 5H5v4H3V3h6zm12 4h-2V5h-4V3h6z" />
  </Svg>
);
export default SvgCameraExposureCross;
