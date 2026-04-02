import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTextSize = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13 10v2H7.93v9h-2v-9H1v-2z" />
    <Path d="M23 6h-6v15h-2V6H9V4h14z" />
  </Svg>
);
export default SvgTextSize;
