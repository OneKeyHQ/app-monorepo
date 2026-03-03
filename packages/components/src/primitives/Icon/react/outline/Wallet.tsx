import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgWallet = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15.5 13.25a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5" />
    <Path
      fillRule="evenodd"
      d="M17 8h4v13H7a4 4 0 0 1-4-4V6.5A3.5 3.5 0 0 1 6.5 3H17zM5 17a2 2 0 0 0 2 2h12v-9H6.5c-.537 0-1.045-.12-1.5-.337zM6.5 5a1.5 1.5 0 1 0 0 3H15V5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgWallet;
