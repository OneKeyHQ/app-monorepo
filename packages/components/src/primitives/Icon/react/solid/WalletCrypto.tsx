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
      d="M10 14.926v4.648l-4 2.333-4-2.333v-4.648l4-2.333zm-6 1.148v2.352l2 1.167 2-1.167v-2.352l-2-1.167z"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M17.001 8h4v13H12v-7.223l-6-3.5-2.999 1.75V6.5a3.5 3.5 0 0 1 3.5-3.5h10.5zM15.5 13.25a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5M6.501 5a1.5 1.5 0 1 0 0 3h8.5V5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgWalletCrypto;
