import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDice4 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M8 14.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3m8 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3m-8-8a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3m8 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3" />
    <Path
      fillRule="evenodd"
      d="M21 21H3V3h18zM5 19h14V5H5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgDice4;
