import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowExpandV = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M17.414 6 16 7.414l-3-3v15.172l3-3L17.414 18 12 23.414 6.586 18 8 16.586l3 3V4.414l-3 3L6.586 6 12 .586z" />
  </Svg>
);
export default SvgArrowExpandV;
