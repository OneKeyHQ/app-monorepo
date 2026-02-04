import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCrypto = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 12a8 8 0 1 0-16 0 8 8 0 0 0 16 0m-8-3.464-3 1.732v3.464l3 1.732 3-1.732v-3.464zM22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10m-5 1.732a2 2 0 0 1-1 1.732l-3 1.732a2 2 0 0 1-2 0l-3-1.732a2 2 0 0 1-1-1.732v-3.464a2 2 0 0 1 1-1.732l3-1.732a2 2 0 0 1 2 0l3 1.732a2 2 0 0 1 1 1.732z" />
  </Svg>
);
export default SvgCrypto;
