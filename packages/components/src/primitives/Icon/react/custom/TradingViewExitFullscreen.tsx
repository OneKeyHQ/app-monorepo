import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTradingViewExitFullscreen = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"
    />
  </Svg>
);
export default SvgTradingViewExitFullscreen;
