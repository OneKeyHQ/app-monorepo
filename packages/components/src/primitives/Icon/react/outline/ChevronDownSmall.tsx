import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronDownSmall = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M17.414 10 12 15.414 6.586 10 8 8.586l4 4 4-4z" />
  </Svg>
);
export default SvgChevronDownSmall;
