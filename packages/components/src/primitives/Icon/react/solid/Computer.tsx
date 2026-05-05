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
      d="M22 18h-7v4H9v-4H2v-4h20zm-11 2h2v-2h-2z"
      clipRule="evenodd"
    />
    <Path d="M22 12H2V3h20z" />
  </Svg>
);
export default SvgComputer;
