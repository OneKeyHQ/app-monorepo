import Svg, { Path } from 'react-native-svg';

import type { SvgProps } from 'react-native-svg';

const SvgHandFront1 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M10.34 2c-.918 0-1.661.746-1.661 1.667v6.666a.555.555 0 1 1-1.108 0V5.89c0-.92-.743-1.667-1.66-1.667-.917 0-1.661.746-1.661 1.667v8.333C4.25 18.518 7.72 22 12 22c4.28 0 7.75-3.482 7.75-7.778v-6.11a2.773 2.773 0 0 0-2.768 2.777v.094c0 .826-.432 1.592-1.138 2.017a3.372 3.372 0 0 0-1.63 2.889.555.555 0 1 1-1.107 0c0-1.574.823-3.032 2.168-3.842.372-.224.6-.628.6-1.064v-.094c0-.752.213-1.454.581-2.05a.556.556 0 0 1-.027-.172v-3.89c0-.92-.744-1.666-1.661-1.666s-1.66.746-1.66 1.667v4.444a.555.555 0 1 1-1.108 0V3.667C12 2.747 11.257 2 10.34 2Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgHandFront1;
