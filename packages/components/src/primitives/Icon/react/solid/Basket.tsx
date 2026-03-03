import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBasket = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M18.179 8H22.2l-2.363 13H4.168L1.805 8h4.02l2.12-5.3 1.857.743L7.979 8h8.045l-1.822-4.557L16.06 2.7 18.18 8Z" />
  </Svg>
);
export default SvgBasket;
