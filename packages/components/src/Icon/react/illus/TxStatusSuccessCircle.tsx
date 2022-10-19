import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgTxStatusSuccessCircle = (props: SvgProps) => (
  <Svg viewBox="0 0 56 56" fill="none" accessibilityRole="image" {...props}>
    <Path
      d="M0 28C0 12.536 12.536 0 28 0s28 12.536 28 28-12.536 28-28 28S0 43.464 0 28Z"
      fill="#195F2B"
    />
    <Path
      d="m25 28 2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      stroke="#5DD27A"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
export default SvgTxStatusSuccessCircle;
