import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFocus = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M16.414 18 12 22.414 7.586 18 9 16.586l3 3 3-3zm-9-9-3 3 3 3L6 16.414 1.586 12 6 7.586zm15 3L18 16.414 16.586 15l3-3-3-3L18 7.586zm-6-6L15 7.414l-3-3-3 3L7.586 6 12 1.586z" />
  </Svg>
);
export default SvgFocus;
