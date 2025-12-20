import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChartLine2 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M5 4a1 1 0 0 0-2 0v14a3 3 0 0 0 3 3h15a1 1 0 1 0 0-2H6a1 1 0 0 1-1-1z"
    />
    <Path
      fill="currentColor"
      d="M15 5a1 1 0 1 0-2 0v11a1 1 0 1 0 2 0zm-5 6a1 1 0 1 0-2 0v5a1 1 0 1 0 2 0zm10 2a1 1 0 1 0-2 0v3a1 1 0 1 0 2 0z"
    />
  </Svg>
);
export default SvgChartLine2;
