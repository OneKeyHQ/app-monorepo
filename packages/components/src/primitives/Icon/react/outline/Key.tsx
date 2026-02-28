import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgKey = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M7 10.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3" />
    <Path
      fillRule="evenodd"
      d="M7 6a5.99 5.99 0 0 1 4.87 2.5h9.11l.301.375 2.5 3.125-2.5 3.125-.3.375h-3.217L16 14.618l-1.764.882H11.87A5.99 5.99 0 0 1 7 18 6 6 0 0 1 7 6m0 2a4 4 0 1 0 3.466 5.999l.288-.499h3.01L16 12.382l2.236 1.118h1.783l1.2-1.5-1.2-1.5h-9.265l-.288-.499A4 4 0 0 0 7 8"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgKey;
