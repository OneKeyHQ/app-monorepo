import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowPathLeft = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M10.999 8h11v8h-11v5.203L.48 12 11 2.796z" />
  </Svg>
);
export default SvgArrowPathLeft;
