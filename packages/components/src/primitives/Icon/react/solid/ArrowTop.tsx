import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowTop = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11.004 20.004V6.478L6.73 10.752a.996.996 0 1 1-1.408-1.408l5.974-5.974.073-.066a.996.996 0 0 1 1.335.066l5.974 5.974a.996.996 0 1 1-1.408 1.408l-4.274-4.274v13.526a.996.996 0 0 1-1.992 0" />
  </Svg>
);
export default SvgArrowTop;
