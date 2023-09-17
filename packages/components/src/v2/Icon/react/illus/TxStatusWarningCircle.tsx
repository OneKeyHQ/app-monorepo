import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTxStatusWarningCircle = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 56 56" accessibilityRole="image" {...props}>
    <Path
      fill="#6B5600"
      d="M0 28C0 12.536 12.536 0 28 0s28 12.536 28 28-12.536 28-28 28S0 43.464 0 28Z"
    />
    <Path
      stroke="#FFD633"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M24 28h.01M28 28h.01M32 28h.01M37 28a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
    />
  </Svg>
);
export default SvgTxStatusWarningCircle;
