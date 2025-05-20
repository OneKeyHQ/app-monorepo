import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCoins = (props: SvgProps) => (
  <Svg viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M9 5a5 5 0 0 0-.941 9.912 7 7 0 0 1 5.112-7.67A5 5 0 0 0 9 5m6.33 2.008a7 7 0 1 0-6.66 9.985 7 7 0 1 0 6.66-9.985M15 9a5 5 0 1 0 0 10 5 5 0 0 0 0-10"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCoins;
