import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSwapHor = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M3.769 16.414c-.781-.78-1.1-1.633-.319-2.414h16.82a1 1 0 1 1 0 2H6.183l2.293 2.293a1 1 0 1 1-1.415 1.414zM20.5 7.586c.781.78 1.1 1.633.318 2.414H4a1 1 0 1 1 0-2h14.086l-2.293-2.293a1 1 0 0 1 1.414-1.414z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSwapHor;
