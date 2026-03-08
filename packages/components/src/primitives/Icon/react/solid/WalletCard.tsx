import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgWalletCard = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M22 20H2V4h20zM4 10h6v2h4v-2h6V9H4zm0-3h16V6H4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgWalletCard;
