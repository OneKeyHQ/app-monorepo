import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCalculator = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M7 2a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V5a3 3 0 0 0-3-3zm11 5V5a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1v2zm-8.25 6.5a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5m0 4.5a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5m5.75-5.75a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0M14.25 18a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCalculator;
