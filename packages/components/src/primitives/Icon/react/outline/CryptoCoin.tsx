import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCryptoCoin = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 12a8 8 0 1 0-16 0 8 8 0 0 0 16 0m-9 5v-.613a4.5 4.5 0 0 1 0-8.775V7a1 1 0 1 1 2 0v.612c.857.195 1.62.634 2.214 1.239a1 1 0 1 1-1.428 1.399 2.5 2.5 0 1 0 0 3.5 1 1 0 1 1 1.428 1.4A4.5 4.5 0 0 1 13 16.386V17a1 1 0 1 1-2 0m11-5c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10" />
  </Svg>
);
export default SvgCryptoCoin;
