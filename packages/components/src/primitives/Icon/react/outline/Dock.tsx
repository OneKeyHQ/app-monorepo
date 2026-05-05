import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDock = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M22 22H6v-9h2v7h12V8h-7V6h9z" />
    <Path d="M9 7.586V3h2v8H3V9h4.586l-5-5L4 2.586z" />
  </Svg>
);
export default SvgDock;
