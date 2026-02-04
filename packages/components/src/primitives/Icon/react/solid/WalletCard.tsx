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
      d="M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zm18 0H4v1h16zm0 3H4v1h5a1 1 0 0 1 1 1v1h4v-1a1 1 0 0 1 1-1h5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgWalletCard;
