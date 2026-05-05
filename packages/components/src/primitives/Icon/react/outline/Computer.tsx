import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgComputer = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M22 18h-7v4H9v-4H2V3h20zm-11 2h2v-2h-2zm-7-4h16v-2H4zm0-4h16V5H4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgComputer;
