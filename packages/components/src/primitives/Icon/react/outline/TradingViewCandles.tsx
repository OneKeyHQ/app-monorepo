import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTradingViewCandles = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M7 2a1 1 0 0 1 1 1v6a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3v2a1 1 0 1 1-2 0v-2a3 3 0 0 1-3-3v-4a3 3 0 0 1 3-3V3a1 1 0 0 1 1-1m10 0a1 1 0 0 1 1 1v2a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3v2a1 1 0 1 1-2 0v-2a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3V3a1 1 0 0 1 1-1m-1 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1zM6 11a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgTradingViewCandles;
