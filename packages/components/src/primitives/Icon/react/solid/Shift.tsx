import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgShift = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M23.83 14h-5.829v7h-12v-7H.171l11.83-12.452L23.831 14Z" />
  </Svg>
);
export default SvgShift;
