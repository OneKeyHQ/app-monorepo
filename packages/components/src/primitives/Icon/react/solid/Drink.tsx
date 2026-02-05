import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDrink = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M16.716 2.976a1 1 0 1 0-.433-1.952l-4.5 1A1 1 0 0 0 11 3v3H7.068a2 2 0 0 0-1.995 2.133l.333 4.995v.005l.534 8A2 2 0 0 0 7.935 23h8.129a2 2 0 0 0 1.996-1.867l.866-13A2 2 0 0 0 16.931 6H13V3.802zM12 8H7.07l.2 3h9.462l.2-3z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgDrink;
