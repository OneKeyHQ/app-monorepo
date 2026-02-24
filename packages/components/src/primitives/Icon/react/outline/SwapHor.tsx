import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSwapHor = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20.134 14.134a1 1 0 1 1 0 2H6.048l2.293 2.293a1 1 0 1 1-1.414 1.414l-3.293-3.293c-.78-.78-1.099-1.633-.318-2.414zm-4.475-9.707a1 1 0 0 1 1.414 0l3.293 3.293c.78.781 1.1 1.633.318 2.414H3.866a1 1 0 0 1 0-2h14.086l-2.293-2.293a1 1 0 0 1 0-1.414" />
  </Svg>
);
export default SvgSwapHor;
