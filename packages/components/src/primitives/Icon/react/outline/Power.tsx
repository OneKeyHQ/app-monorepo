import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPower = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 1a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0V2a1 1 0 0 1 1-1M7.856 3.946a1 1 0 0 1-.279 1.387 8 8 0 1 0 8.846 0 1 1 0 1 1 1.107-1.666A9.99 9.99 0 0 1 22 12c0 5.523-4.477 10-10 10S2 17.523 2 12a9.99 9.99 0 0 1 4.47-8.333 1 1 0 0 1 1.386.28Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPower;
