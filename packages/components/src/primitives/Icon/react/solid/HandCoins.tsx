import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgHandCoins = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M7.6 12.695a4.2 4.2 0 0 1 1.596-.182l4.894.388.017.001c.322.03.493.357.457.678-.15 1.314-1.163 2.39-2.518 2.68l-1.942.417.329 1.391 1.942-.416C13.951 17.315 14.5 17 15.5 15.75L18 15c1.557-.444 3-.074 3 1.472 0 .784-.419 1.53-1.148 1.947a49 49 0 0 1-3.894 2.005c-1.57.712-3.388 1.402-4.858 1.542-1.375.13-3.01-.14-4.229-.41a28 28 0 0 1-2.02-.533l-.013-.003H3v-6.867zM14.5 4a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7m-5-2c.83 0 1.592.288 2.191.77a5.5 5.5 0 0 0-2.488 6.217A3.5 3.5 0 0 1 9.5 2" />
  </Svg>
);
export default SvgHandCoins;
