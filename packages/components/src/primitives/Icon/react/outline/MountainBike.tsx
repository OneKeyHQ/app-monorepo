import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMountainBike = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m15.256 4 .164.007a2 2 0 0 1 1.752 1.419l2.786 9.287a1 1 0 0 1-1.916.574l-1.548-5.157-11.031 5.757a1 1 0 0 1-.926-1.774l5.155-2.69L7.2 8.1a1 1 0 0 1-.065-.1H7a1 1 0 1 1 0-2h3a1 1 0 1 1 0 2h-.376l1.864 2.485L15.91 8.18 15.256 6H14a1 1 0 1 1 0-2z" />
    <Path d="M22 15a3 3 0 1 0-6 0 3 3 0 0 0 6 0m2 0a5 5 0 1 1-10 0 5 5 0 0 1 10 0M8 15a3 3 0 1 0-6 0 3 3 0 0 0 6 0m2 0a5 5 0 1 1-10 0 5 5 0 0 1 10 0" />
  </Svg>
);
export default SvgMountainBike;
