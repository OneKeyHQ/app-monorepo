import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTradingViewCandles = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M8 2v7h3v10H8v3H6v-3H3V9h3V2zm10 0v3h3v14h-3v3h-2v-3h-3V5h3V2z" />
  </Svg>
);
export default SvgTradingViewCandles;
