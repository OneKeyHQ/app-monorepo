import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgRadar = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M17.977 3.982A9.99 9.99 0 0 1 22 12c0 5.523-4.477 10-10 10S2 17.523 2 12a9.99 9.99 0 0 1 4.023-8.018L8.1 7.442a6 6 0 1 0 7.803 0z" />
    <Path d="M14.85 9.193a4 4 0 1 1-5.701 0l1.102 1.835a2 2 0 1 0 3.498 0l1.102-1.835Z" />
    <Path d="M12 2c1.525 0 2.97.341 4.263.951L12.034 10h-.067l-4.23-7.049A10 10 0 0 1 12 2" />
  </Svg>
);
export default SvgRadar;
