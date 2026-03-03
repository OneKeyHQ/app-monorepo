import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSwapVer = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M16 3v14.086l2.293-2.293 1.414 1.414L14 21.914V3zm-6-.914V21H8V6.914L5.707 9.207 4.293 7.793z" />
  </Svg>
);
export default SvgSwapVer;
