import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDice4 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M5 5v14h14V5zm16 14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    <Path d="M8 14.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3m8 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3m-8-8a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3m8 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3" />
  </Svg>
);
export default SvgDice4;
