import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPiggyMoney = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M6.661 3.094c1.33.222 2.248.804 2.839 1.353.211.197.38.387.509.553H14a7 7 0 0 1 6.72 8.96 1.002 1.002 0 0 0 1.146-1.459 1 1 0 0 1 1.73-1.002 3 3 0 0 1-3.714 4.286A7 7 0 0 1 19 16.89V19a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2h-2a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-1.45A5.8 5.8 0 0 1 3.448 16H3a2 2 0 0 1-2-2v-3.065a2 2 0 0 1 2-2h.324c.286-.648.657-1.29 1.176-1.851V5c0-1.046.89-2.119 2.161-1.906M8.25 9.5a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5" />
  </Svg>
);
export default SvgPiggyMoney;
