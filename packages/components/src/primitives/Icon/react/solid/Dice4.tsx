import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDice4 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M6 21a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3zM8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3m0 8a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3m9.5-1.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0M16 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgDice4;
