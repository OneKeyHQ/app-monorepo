import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMountainBike = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M18.55 10.02a5 5 0 1 1-1.917.574l-.139-.464-6.688 3.49a5 5 0 1 1-.926-1.773l.812-.424L7.2 8.1 7.125 8H6V6h5v2H9.624l1.864 2.485L15.91 8.18 15.256 6H13V4h3.744zM5 12a3 3 0 1 0 2.97 2.578L4.576 16.35l-.926-1.774 3.391-1.77A2.99 2.99 0 0 0 5 12m15.245 3.67-1.916.575-1.1-3.664a3 3 0 1 0 1.915-.578l1.101 3.668Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMountainBike;
