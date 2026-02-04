import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBitcoin = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 12a8 8 0 1 0-16 0 8 8 0 0 0 16 0m-6 1.75a.75.75 0 0 0-.75-.75H11v1.5h2.25a.75.75 0 0 0 .75-.75m0-3.5a.75.75 0 0 0-.75-.75H11V11h2.25a.75.75 0 0 0 .75-.75M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10m-6-1.75c0 .665-.236 1.274-.629 1.75a2.75 2.75 0 0 1-2.121 4.5H13v.5a1 1 0 1 1-2 0v-.5H8.5a1 1 0 1 1 0-2H9v-5h-.5a1 1 0 0 1 0-2H11V7a1 1 0 1 1 2 0v.5h.25A2.75 2.75 0 0 1 16 10.25" />
  </Svg>
);
export default SvgBitcoin;
