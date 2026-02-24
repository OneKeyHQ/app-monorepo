import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBike = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M18.55 10.02a5 5 0 1 1-1.916.574l-.279-.927L13 13.442V16H9.9a5.001 5.001 0 1 1 0-2H11v-.676L7.191 8.088 7.128 8H6V6h5v2H9.6l2.502 3.44 3.578-4.024L15.256 6H13V4h3.744zM5 12a3 3 0 1 0 2.826 4H4v-2h3.826A3 3 0 0 0 5 12m15.245 3.67-1.916.575-1.1-3.664a3 3 0 1 0 1.915-.578l1.101 3.668Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBike;
