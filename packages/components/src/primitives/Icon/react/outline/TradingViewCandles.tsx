import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTradingViewCandles = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M8 9h3v10H8v3H6v-3H3V9h3V2h2zm-3 8h4v-6H5zM18 5h3v14h-3v3h-2v-3h-3V5h3V2h2zm-3 12h4V7h-4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgTradingViewCandles;
