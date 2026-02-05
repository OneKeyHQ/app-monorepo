import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTradingViewCandles = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M5 11v6h4v-6zm10-4v10h4V7zm-4 10a2 2 0 0 1-2 2H8v2a1 1 0 1 1-2 0v-2H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2h1V3a1 1 0 0 1 2 0v6h1a2 2 0 0 1 2 2zm10 0a2 2 0 0 1-2 2h-1v2a1 1 0 1 1-2 0v-2h-1a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1V3a1 1 0 1 1 2 0v2h1a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgTradingViewCandles;
