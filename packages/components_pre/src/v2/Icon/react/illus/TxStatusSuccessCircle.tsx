import Svg, { Path } from 'react-native-svg';

import type { SvgProps } from 'react-native-svg';

const SvgTxStatusSuccessCircle = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 56 56" accessibilityRole="image" {...props}>
    <Path
      fill="#195F2B"
      d="M0 28C0 12.536 12.536 0 28 0s28 12.536 28 28-12.536 28-28 28S0 43.464 0 28Z"
    />
    <Path
      stroke="#5DD27A"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m25 28 2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
    />
  </Svg>
);
export default SvgTxStatusSuccessCircle;
