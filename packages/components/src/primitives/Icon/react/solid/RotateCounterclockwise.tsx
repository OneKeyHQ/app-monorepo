import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgRotateCounterclockwise = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M18 5.423a10 10 0 0 0-1.579-1.213C15.14 3.423 13.7 3 11.973 3a9 9 0 1 0 8.487 12l-1.885-.667A7 7 0 1 1 11.973 5c1.37 0 2.444.328 3.401.915.475.291.93.652 1.384 1.085h-2.757v2h6V3h-2z" />
  </Svg>
);
export default SvgRotateCounterclockwise;
