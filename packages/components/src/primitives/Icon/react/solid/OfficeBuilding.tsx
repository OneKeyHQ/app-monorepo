import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgOfficeBuilding = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M20 19V6a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v13H3a1 1 0 1 0 0 2h18a1 1 0 1 0 0-2zM9 7a1 1 0 0 0 0 2h1a1 1 0 1 0 0-2zm5 0a1 1 0 1 0 0 2h1a1 1 0 1 0 0-2zm-5 4a1 1 0 1 0 0 2h1a1 1 0 1 0 0-2zm5 0a1 1 0 1 0 0 2h1a1 1 0 1 0 0-2zm-5 4a1 1 0 1 0 0 2h1a1 1 0 1 0 0-2zm5 0a1 1 0 1 0 0 2h1a1 1 0 1 0 0-2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgOfficeBuilding;
