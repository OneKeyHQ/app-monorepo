import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgWalletCrypto = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M5.496 12.886a1 1 0 0 1 1.008 0l3 1.75A1 1 0 0 1 10 15.5V19a1 1 0 0 1-.496.864l-3 1.75a1 1 0 0 1-1.008 0l-3-1.75A1 1 0 0 1 2 19v-3.5a1 1 0 0 1 .496-.864zM4 16.074v2.352l2 1.167 2-1.167v-2.352l-2-1.167z"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M15.25 3c.966 0 1.75.783 1.75 1.75V8h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7v-5.5a3 3 0 0 0-1.488-2.591l-3-1.75a3 3 0 0 0-3.024 0L3 12.027V6.5A3.5 3.5 0 0 1 6.5 3zm.25 10a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3m-9-8a1.5 1.5 0 1 0 0 3H15V5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgWalletCrypto;
