import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPeople = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 2.27a4.372 4.372 0 1 0 0 8.744 4.372 4.372 0 0 0 0-8.744m.002 9.716c-4.177 0-7.236 2.801-8.068 6.505-.282 1.253.745 2.239 1.848 2.239h12.439c1.103 0 2.13-.986 1.848-2.239-.832-3.704-3.89-6.505-8.067-6.505" />
  </Svg>
);
export default SvgPeople;
