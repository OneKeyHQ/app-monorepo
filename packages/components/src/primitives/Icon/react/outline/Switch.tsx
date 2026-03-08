import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSwitch = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M16 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8m0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M16 5a7 7 0 1 1 0 14H8A7 7 0 1 1 8 5zM8 7a5 5 0 1 0 0 10h8a5 5 0 0 0 0-10z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSwitch;
