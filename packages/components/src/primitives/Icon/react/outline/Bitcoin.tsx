import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBitcoin = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M13 7.5h.25a2.75 2.75 0 0 1 2.121 4.5 2.75 2.75 0 0 1-2.121 4.5H13V18h-2v-1.5H7.5v-2H9v-5H7.5v-2H11V6h2zm-2 7h2.25a.75.75 0 0 0 0-1.5H11zm0-3.5h2.25a.75.75 0 0 0 0-1.5H11z"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBitcoin;
