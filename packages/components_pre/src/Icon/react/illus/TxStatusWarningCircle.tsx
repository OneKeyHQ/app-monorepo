import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgTxStatusWarningCircle = (props: SvgProps) => (
  <Svg viewBox="0 0 56 56" fill="none" accessibilityRole="image" {...props}>
    <Path
      d="M0 28C0 12.536 12.536 0 28 0s28 12.536 28 28-12.536 28-28 28S0 43.464 0 28Z"
      fill="#6B5600"
    />
    <Path
      d="M24 28h.01M28 28h.01M32 28h.01M37 28a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      stroke="#FFD633"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
export default SvgTxStatusWarningCircle;
