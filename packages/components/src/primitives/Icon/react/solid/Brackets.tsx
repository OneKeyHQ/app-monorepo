import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBrackets = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M9 5H6v14h3v2H4v-8H2v-2h2V3h5zm11 6h2v2h-2v8h-5v-2h3V5h-3V3h5z" />
  </Svg>
);
export default SvgBrackets;
