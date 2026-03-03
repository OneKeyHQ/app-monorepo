import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgInfoSquare = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M13 9h-2V7h2zm-1.5-.5h1v-1h-1z"
      clipRule="evenodd"
    />
    <Path d="M11 12h-1v-2h3v7h-2z" />
    <Path
      fillRule="evenodd"
      d="M21 3v18H3V3zM5 19h14V5H5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgInfoSquare;
