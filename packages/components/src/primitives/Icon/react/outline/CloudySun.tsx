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
      d="M15 5a5 5 0 0 1 4.6 6.959A5.5 5.5 0 0 1 16.5 22H9a7 7 0 1 1 1.36-13.866A5 5 0 0 1 15 5m-6 5a5 5 0 0 0 0 10h7.5a3.5 3.5 0 1 0-1.592-6.618l-.928.475-.436-.947a5.02 5.02 0 0 0-2.835-2.61A5 5 0 0 0 9 10m6-3c-1.23 0-2.288.74-2.751 1.8a7 7 0 0 1 2.652 2.436 5.5 5.5 0 0 1 2.87-.087A3 3 0 0 0 15 7"
      clipRule="evenodd"
    />
    <Path d="M24 10.5h-2.5v-2H24zM11.463 4.55l-1.414 1.415-.707-.707-.354-.355-.707-.707 1.414-1.414zm10.252-.354-1.768 1.769-1.414-1.415 1.768-1.768zM16 3.5h-2V1h2z" />
  </Svg>
);
export default SvgCloudySun;
