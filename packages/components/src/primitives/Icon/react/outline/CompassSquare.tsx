import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCompassSquare = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="m14.866 14.866-6.919 1.188 1.187-6.92 6.92-1.187zm-4-4-.47 2.738 2.738-.47.47-2.738z"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M21 21H3V3h18zM5 19h14V5H5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCompassSquare;
