import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPerformance = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12c0-1.167.2-2.29.57-3.333l.332-.943 1.886.667-.333.942A8 8 0 1 0 13 4.063V6h-2V2z" />
    <Path
      fillRule="evenodd"
      d="M10.335 8.92a3.5 3.5 0 1 1-1.414 1.414L4.336 5.751 5.75 4.336zM12 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPerformance;
