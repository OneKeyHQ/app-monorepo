import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgOnekeyLite = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11 14a1 1 0 1 1 0 2H7a1 1 0 1 1 0-2zm-3-3.5a1 1 0 1 1 0 2H7a1 1 0 1 1 0-2z" />
    <Path
      fillRule="evenodd"
      d="M20 4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM4 18h16V6H4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgOnekeyLite;
