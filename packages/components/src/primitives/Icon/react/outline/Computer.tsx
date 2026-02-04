import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgComputer = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 14H4v2h16zm-9 6h2v-2h-2zM4 5v7h16V5zm18 11a2 2 0 0 1-2 2h-5v3a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-3H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgComputer;
