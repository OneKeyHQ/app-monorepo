import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCameraExposureFlower = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M5 19h4v2H3v-6h2zm16 2h-6v-2h4v-4h2z" />
    <Path
      fillRule="evenodd"
      d="M13.479 8.314 16 7.234V11a4 4 0 0 1-3 3.874V17h-2v-2.126A4 4 0 0 1 8 11V7.233l2.521 1.081L12 6.836zm-2.5 2.371-.623-.266-.356-.153V11a2 2 0 1 0 4 0v-.734l-.356.153-.623.266L12 9.665z"
      clipRule="evenodd"
    />
    <Path d="M9 5H5v4H3V3h6zm12 4h-2V5h-4V3h6z" />
  </Svg>
);
export default SvgCameraExposureFlower;
