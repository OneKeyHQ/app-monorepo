import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCloudySun = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M15 5a5 5 0 0 1 4.602 6.958A5.5 5.5 0 0 1 16.5 22H9a7 7 0 1 1 1.36-13.867A5 5 0 0 1 15 5m0 2a3 3 0 0 0-2.75 1.799 7.03 7.03 0 0 1 2.652 2.436 5.5 5.5 0 0 1 2.87-.087A3 3 0 0 0 15 7"
      clipRule="evenodd"
    />
    <Path d="M24 10.5h-2.5v-2H24zM11.463 4.55l-1.414 1.415L8.28 4.196l1.414-1.414zm10.252-.354-1.768 1.769-1.414-1.415 1.768-1.768zM16 3.5h-2V1h2z" />
  </Svg>
);
export default SvgCloudySun;
