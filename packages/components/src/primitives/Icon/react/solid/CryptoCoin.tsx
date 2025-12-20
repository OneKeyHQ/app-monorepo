import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCryptoCoin = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12m11-5a1 1 0 1 0-2 0v.612a4.502 4.502 0 0 0 0 8.777V17a1 1 0 1 0 2 0v-.612a4.5 4.5 0 0 0 2.214-1.239 1 1 0 1 0-1.428-1.4 2.5 2.5 0 1 1 0-3.5 1 1 0 1 0 1.428-1.398A4.5 4.5 0 0 0 13 7.61z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCryptoCoin;
