import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronLeftSmall = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m15.414 8-4 4 4 4L14 17.414 8.586 12 14 6.586z" />
  </Svg>
);
export default SvgChevronLeftSmall;
