import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgWallet = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M6.5 3A3.5 3.5 0 0 0 3 6.5V17a4 4 0 0 0 4 4h11a3 3 0 0 0 3-3v-7a3 3 0 0 0-3-3h-1V5.412A2.41 2.41 0 0 0 14.588 3zM15 8V5.412A.41.41 0 0 0 14.588 5H6.5a1.5 1.5 0 1 0 0 3zm.5 7.75a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgWallet;
