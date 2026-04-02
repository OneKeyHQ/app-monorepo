import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBitcoin = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13.25 13a.75.75 0 0 1 0 1.5H11V13zm0-3.5a.75.75 0 0 1 0 1.5H11V9.5z" />
    <Path
      fillRule="evenodd"
      d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m-1 5.5H7.5v2H9v5H7.5v2H11V18h2v-1.5h.25a2.75 2.75 0 0 0 2.121-4.5 2.75 2.75 0 0 0-2.121-4.5H13V6h-2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBitcoin;
