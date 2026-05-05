import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBold = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12.833 3c3.036 0 5.334 2.556 5.334 5.5a5.63 5.63 0 0 1-.856 2.983A5.6 5.6 0 0 1 19 15.5c0 2.944-2.297 5.5-5.333 5.5H5V3z" />
  </Svg>
);
export default SvgBold;
