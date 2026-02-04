import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSwapHor = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M20.366 7.72c.78.781 1.1 1.633.318 2.414H3.866a1 1 0 0 1 0-2H17.95l-2.29-2.293a1 1 0 1 1 1.414-1.414l3.293 3.293ZM3.634 16.549c-.78-.782-1.1-1.634-.318-2.415h16.818a1 1 0 1 1 0 2H6.05l2.292 2.293a1 1 0 1 1-1.414 1.414l-3.293-3.293Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSwapHor;
