import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAkash = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 16 16" accessibilityRole="image" {...props}>
    <Path
      fill="#8C8CA1"
      fillRule="evenodd"
      d="m6.154 3.467 5.219 9.013L13.1 9.464 9.61 3.467H6.154Z"
      clipRule="evenodd"
    />
    <Path
      fill="#8C8CA1"
      fillRule="evenodd"
      d="M6.154 9.634 7.95 12.48h3.592L9.746 9.634H6.154Z"
      clipRule="evenodd"
    />
    <Path
      fill="#8C8CA1"
      fillRule="evenodd"
      d="M4.596 6.313 2.8 9.396l1.796 3.084L8.22 6.313H4.596Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAkash;
