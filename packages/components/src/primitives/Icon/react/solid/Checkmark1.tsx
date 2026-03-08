import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCheckmark1 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m20.576 5.065-10.414 15.93-6.777-7.907 2.277-1.953 4.176 4.872 8.228-12.583z" />
  </Svg>
);
export default SvgCheckmark1;
