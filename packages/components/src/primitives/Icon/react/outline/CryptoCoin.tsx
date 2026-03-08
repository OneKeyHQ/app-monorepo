import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCryptoCoin = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11 16.387a4.5 4.5 0 0 1 0-8.775V6h2v1.613a4.5 4.5 0 0 1 2.856 2.067l-1.712 1.032a2.5 2.5 0 1 0 0 2.576l1.712 1.032A4.5 4.5 0 0 1 13 16.386V18h-2z" />
    <Path
      fillRule="evenodd"
      d="M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10m-2 0a8 8 0 1 0-16 0 8 8 0 0 0 16 0"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCryptoCoin;
