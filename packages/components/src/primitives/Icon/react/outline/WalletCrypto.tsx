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
      d="M6.504 12.886 10 14.926v4.648l-3.496 2.04-.504.293-.504-.293L2 19.574v-4.648l3.496-2.04.504-.293zM4 16.074v2.35l2 1.168 2-1.167v-2.35l-2-1.167z"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M17 8h4v13h-9v-2h7v-9H6.5c-.537 0-1.045-.12-1.5-.337V11.5H3v-5A3.5 3.5 0 0 1 6.5 3H17zM6.5 5a1.5 1.5 0 1 0 0 3H15V5z"
      clipRule="evenodd"
    />
    <Path d="M15.5 13.25a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5" />
  </Svg>
);
export default SvgWalletCrypto;
