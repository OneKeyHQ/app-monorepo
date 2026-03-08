import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgStopwatch = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13.414 13 12 14.414 7.586 10 9 8.586z" />
    <Path
      fillRule="evenodd"
      d="M12 4a9 9 0 1 1 0 18 9 9 0 0 1 0-18m0 2a7 7 0 1 0 0 14 7 7 0 0 0 0-14"
      clipRule="evenodd"
    />
    <Path d="M15 3H9V1h6z" />
  </Svg>
);
export default SvgStopwatch;
