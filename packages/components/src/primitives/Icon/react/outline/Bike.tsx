import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBike = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11 14v-.675L7.191 8.088A1 1 0 0 1 7.134 8H7a1 1 0 0 1 0-2h3a1 1 0 1 1 0 2h-.4l3.017 4.148c.249.342.383.755.383 1.177V14a2 2 0 0 1-2 2H5a1 1 0 1 1 0-2zm4.256-10 .164.007a2 2 0 0 1 1.752 1.419l2.786 9.287a1 1 0 0 1-1.916.574L15.256 6H14a1 1 0 1 1 0-2z" />
    <Path d="M22 15a3 3 0 1 0-6 0 3 3 0 0 0 6 0m2 0a5 5 0 1 1-10 0 5 5 0 0 1 10 0M8 15a3 3 0 1 0-6 0 3 3 0 0 0 6 0m2 0a5 5 0 1 1-10 0 5 5 0 0 1 10 0" />
    <Path d="M15.753 7.336a1 1 0 1 1 1.494 1.328l-4 4.5a1 1 0 1 1-1.494-1.328z" />
  </Svg>
);
export default SvgBike;
