import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCup2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M18 9h.5a3.5 3.5 0 1 1 0 7H18v6H4V7h14zM6 20h10V9H6zm12-6h.5a1.5 1.5 0 0 0 0-3H18z"
      clipRule="evenodd"
    />
    <Path d="M8 6H6V2h2zm4 0h-2V2h2zm4 0h-2V2h2z" />
  </Svg>
);
export default SvgCup2;
