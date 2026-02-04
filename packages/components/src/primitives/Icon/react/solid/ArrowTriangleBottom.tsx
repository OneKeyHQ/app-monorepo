import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowTriangleBottom = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4.213 6.89C3.54 5.538 4.547 4 6.02 4h11.96c1.472 0 2.479 1.539 1.806 2.89l-5.982 11.997c-.74 1.484-2.87 1.484-3.61 0L4.213 6.889Z" />
  </Svg>
);
export default SvgArrowTriangleBottom;
