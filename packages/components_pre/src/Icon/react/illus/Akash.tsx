import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAkash = (props: SvgProps) => (
  <Svg viewBox="0 0 16 16" fill="none" accessibilityRole="image" {...props}>
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="m6.154 3.467 5.219 9.013L13.1 9.464 9.61 3.467H6.154Z"
      fill="#8C8CA1"
    />
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M6.154 9.634 7.95 12.48h3.592L9.746 9.634H6.154Z"
      fill="#8C8CA1"
    />
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M4.596 6.313 2.8 9.396l1.796 3.084L8.22 6.313H4.596Z"
      fill="#8C8CA1"
    />
  </Svg>
);
export default SvgAkash;
