import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPerformance = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13.5 12a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0M11 5V3a1 1 0 0 1 1-1c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12c0-1.167.2-2.29.57-3.333a1 1 0 0 1 1.885.666A8 8 0 1 0 13 4.063V5a1 1 0 1 1-2 0m4.5 7a3.5 3.5 0 1 1-6.58-1.665L5.044 6.457a1 1 0 1 1 1.414-1.414l3.878 3.878A3.5 3.5 0 0 1 15.5 12" />
  </Svg>
);
export default SvgPerformance;
