import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTilde = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M3.002 14.75c-.026-1.608.209-2.216.7-3.195q.737-1.467 1.913-2.136a5.04 5.04 0 0 1 2.507-.669q1.319 0 2.405.654 1.098.64 2.507 2.02.957.93 1.525 1.309.582.378 1.267.377 1.111 0 1.758-.9c.43-.611.64-.807.622-1.96h2.792c.026 1.608-.209 2.216-.7 3.195q-.723 1.467-1.913 2.136a5.04 5.04 0 0 1-2.507.669 4.65 4.65 0 0 1-2.404-.64q-1.086-.654-2.508-2.034-.943-.93-1.525-1.309a2.3 2.3 0 0 0-1.267-.377q-1.047 0-1.732.828c-.448.543-.665.763-.648 2.032z"
    />
  </Svg>
);
export default SvgTilde;
