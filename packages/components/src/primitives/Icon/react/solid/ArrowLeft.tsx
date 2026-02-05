import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowLeft = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M9.305 5.361a.995.995 0 1 1 1.408 1.408l-4.275 4.275h13.527a.996.996 0 1 1 0 1.99H6.438l4.275 4.275a.995.995 0 1 1-1.408 1.408L3.33 12.743a.996.996 0 0 1 0-1.408z" />
  </Svg>
);
export default SvgArrowLeft;
