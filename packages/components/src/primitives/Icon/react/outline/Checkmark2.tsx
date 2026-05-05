import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCheckmark2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M22.398 3.783 9.486 21.431l-7.891-6.27 1.244-1.566L9.1 18.569 20.783 2.603z" />
  </Svg>
);
export default SvgCheckmark2;
