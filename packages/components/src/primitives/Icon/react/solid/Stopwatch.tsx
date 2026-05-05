import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgStopwatch = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 4a9 9 0 1 1 0 18 9 9 0 0 1 0-18m-4.414 6L12 14.414 13.414 13 9 8.586z"
      clipRule="evenodd"
    />
    <Path d="M15 3H9V1h6z" />
  </Svg>
);
export default SvgStopwatch;
