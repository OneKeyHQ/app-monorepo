import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDisk1 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M7 9h10V3h.414L21 6.586V21h-4v-9H7v9H3V3h4z" />
    <Path d="M15 14v7H9v-7zm0-7H9V3h6z" />
  </Svg>
);
export default SvgDisk1;
