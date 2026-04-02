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
    <Path
      fillRule="evenodd"
      d="M21 14H10V4h11zm-9-2h7V6h-2.5v3h-2V6H12z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPackageDelivery;
