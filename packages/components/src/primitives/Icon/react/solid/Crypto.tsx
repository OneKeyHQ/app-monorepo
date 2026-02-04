import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCrypto = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m9 10.268 3-1.732 3 1.732v3.464l-3 1.732-3-1.732z" />
    <Path
      fillRule="evenodd"
      d="M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12m14-3.464-3-1.732a2 2 0 0 0-2 0L8 8.536a2 2 0 0 0-1 1.732v3.464a2 2 0 0 0 1 1.732l3 1.732a2 2 0 0 0 2 0l3-1.732a2 2 0 0 0 1-1.732v-3.464a2 2 0 0 0-1-1.732"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCrypto;
