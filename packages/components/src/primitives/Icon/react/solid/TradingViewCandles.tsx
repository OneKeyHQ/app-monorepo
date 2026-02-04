import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTradingViewCandles = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M8 3a1 1 0 0 0-2 0v6H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h1v2a1 1 0 1 0 2 0v-2h1a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H8zm10 0a1 1 0 1 0-2 0v2h-1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h1v2a1 1 0 1 0 2 0v-2h1a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1z" />
  </Svg>
);
export default SvgTradingViewCandles;
