import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPackageDelivery = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M8 13.126A4.01 4.01 0 0 1 10.874 16H21v2H10.874A4.002 4.002 0 0 1 3 17a4 4 0 0 1 3-3.874V5H3V3h5zM7 15a2 2 0 1 0 0 4 2 2 0 0 0 0-4"
      clipRule="evenodd"
    />
    <Path d="M14.5 9h2V4H21v10H10V4h4.5z" />
  </Svg>
);
export default SvgPackageDelivery;
