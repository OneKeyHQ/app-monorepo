import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCloud = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M5.598 8.165a7 7 0 0 1 13.343 1.923A5.002 5.002 0 0 1 18 20H7A6 6 0 0 1 5.598 8.165M12 6a5 5 0 0 0-4.729 3.37 1 1 0 0 1-.812.666A4.001 4.001 0 0 0 7 18h11a3 3 0 1 0 0-6 1 1 0 0 1-1-1 5 5 0 0 0-5-5"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCloud;
