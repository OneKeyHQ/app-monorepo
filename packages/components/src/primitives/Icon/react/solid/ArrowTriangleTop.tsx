import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowTriangleTop = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4.213 17.11C3.54 18.462 4.547 20 6.02 20h11.96c1.472 0 2.479-1.539 1.806-2.89L13.805 5.114c-.74-1.484-2.87-1.484-3.61 0L4.213 17.111Z" />
  </Svg>
);
export default SvgArrowTriangleTop;
