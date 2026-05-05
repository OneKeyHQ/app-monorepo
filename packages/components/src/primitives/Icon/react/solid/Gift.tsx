import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgGift = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11 21H4v-8h7zm9 0h-7v-8h7zM15.333 2A2.667 2.667 0 0 1 18 4.667c0 .859-.25 1.66-.682 2.333H21v4h-8V7h.667A2.333 2.333 0 0 0 16 4.667.667.667 0 0 0 15.333 4 2.333 2.333 0 0 0 13 6.333V7h-2v-.667A2.333 2.333 0 0 0 8.667 4 .667.667 0 0 0 8 4.667 2.333 2.333 0 0 0 10.333 7H11v4H3V7h3.682A4.3 4.3 0 0 1 6 4.667 2.667 2.667 0 0 1 8.667 2c1.34 0 2.538.609 3.333 1.564A4.32 4.32 0 0 1 15.333 2" />
  </Svg>
);
export default SvgGift;
