import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowBottom = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11.004 4.074a.996.996 0 0 1 1.992 0v13.527l4.274-4.274a.995.995 0 1 1 1.408 1.408l-5.974 5.973a.996.996 0 0 1-1.408 0l-5.974-5.973a.995.995 0 1 1 1.408-1.408l4.274 4.274z" />
  </Svg>
);
export default SvgArrowBottom;
