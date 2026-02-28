import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgUndock = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M22 22H6v-9h2v7h12V8h-7V6h9z" />
    <Path d="M11 5H6.414l5.25 5.25-1.414 1.414L5 6.414V11H3V3h8z" />
  </Svg>
);
export default SvgUndock;
