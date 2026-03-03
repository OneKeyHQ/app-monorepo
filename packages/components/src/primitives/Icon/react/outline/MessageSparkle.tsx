import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMessageSparkle = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12.573 7c0 1.32.292 2.139.791 2.638s1.319.79 2.638.79v1.143c-1.32 0-2.139.292-2.638.791s-.79 1.319-.79 2.638H11.43c0-1.32-.292-2.139-.791-2.638s-1.319-.79-2.638-.79v-1.143c1.32 0 2.138-.292 2.638-.791.499-.5.79-1.319.79-2.638h1.143Z" />
    <Path
      fillRule="evenodd"
      d="M21.002 19.036h-5.627l-3.38 2.802-3.343-2.802h-5.65V3h18zm-16-2h4.377L12 19.233l2.377-1.967.278-.23h4.347V5h-14z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMessageSparkle;
