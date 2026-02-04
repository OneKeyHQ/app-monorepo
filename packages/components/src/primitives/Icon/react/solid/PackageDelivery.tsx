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
      d="M3 4a1 1 0 0 1 1-1h2a2 2 0 0 1 2 2v8.126A4.01 4.01 0 0 1 10.874 16H20a1 1 0 1 1 0 2h-9.126A4.002 4.002 0 0 1 3 17a4 4 0 0 1 3-3.874V5H4a1 1 0 0 1-1-1m4 11a2 2 0 1 1 0 4 2 2 0 0 1 0-4"
      clipRule="evenodd"
    />
    <Path d="M12 4h2.5v4a1 1 0 1 0 2 0V4H19a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2" />
  </Svg>
);
export default SvgPackageDelivery;
