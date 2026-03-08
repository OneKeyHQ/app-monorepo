import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFilter1 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M21 3v5.414l-6 6v6.367l-6 1.5v-7.867l-6-6V3z" />
  </Svg>
);
export default SvgFilter1;
