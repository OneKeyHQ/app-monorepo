import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgWalletCard = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M14 11a1 1 0 0 1 1-1h5V9H4v1h5a1 1 0 0 1 1 1v1h4zM4 6v1h16V6zm12 6a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2H4v6h16v-6zm6 6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgWalletCard;
