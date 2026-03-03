import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowExpandH = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M23.414 12 18 17.414 16.586 16l3-3H4.414l3 3L6 17.414.586 12 6 6.586 7.414 8l-3 3h15.172l-3-3L18 6.586z" />
  </Svg>
);
export default SvgArrowExpandH;
