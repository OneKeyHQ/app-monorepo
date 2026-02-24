import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgImageAnimal = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M16.608 16.002c.684-.183 1.338.037 1.46.493.123.456-.333.975-1.017 1.158-.684.184-1.338-.038-1.46-.494s.333-.974 1.017-1.157m-3.983-2.475c.57-.152 1.182.279 1.365.963s-.13 1.363-.7 1.516c-.571.152-1.182-.279-1.365-.963s.13-1.363.7-1.516" />
    <Path
      fillRule="evenodd"
      d="M21 3v18H3V3zm-3.556 5.983a9.7 9.7 0 0 0-2.567.335 9.7 9.7 0 0 0-2.392.995L8.24 9.326l.878 4.863c-.324.945-.384 1.937-.125 2.903A4.8 4.8 0 0 0 10.011 19H19v-4.657c-.398-.109-.75-.47-.88-.96-.184-.684.13-1.362.7-1.515a1 1 0 0 1 .18-.03V7.5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgImageAnimal;
