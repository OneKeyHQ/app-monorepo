import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgImageMountain = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M17.5 9a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0" />
    <Path
      fillRule="evenodd"
      d="M5 3h14c1.1 0 2 .9 2 2v14c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V5c0-1.1.9-2 2-2m14 9.83V5H5v7.22l1.27-.95.02-.02a2.99 2.99 0 0 1 3.86.45c1.47 1.58 2.94 2.75 4.85 2.75 1.7 0 2.86-.56 4-1.62"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgImageMountain;
