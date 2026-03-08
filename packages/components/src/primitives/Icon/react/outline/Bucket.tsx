import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBucket = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M22 9h-1.614l-1.503 12H5.118L3.615 9H2V3h20zM5.63 9l1.253 10h10.234l1.254-10zM4 6.998h16V5H4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBucket;
