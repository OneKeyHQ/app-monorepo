import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSimCard = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M10 13h4v3h-4z" />
    <Path
      fillRule="evenodd"
      d="M4 4a2 2 0 0 1 2-2h7.172a3 3 0 0 1 2.12.879l3.83 3.828A3 3 0 0 1 20 8.828V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zm6 7a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSimCard;
