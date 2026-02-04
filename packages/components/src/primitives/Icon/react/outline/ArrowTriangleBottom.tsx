import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowTriangleBottom = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M17.983 4.001c1.47 0 2.478 1.54 1.805 2.89l-5.983 11.995c-.74 1.484-2.87 1.484-3.61 0L4.212 6.89C3.54 5.54 4.546 4 6.018 4h11.965ZM6.006 6.002l-.003.002 5.98 11.99.002.002q.005.002.015.003.01 0 .014-.003l.003-.003 5.98-11.989-.003-.002z" />
  </Svg>
);
export default SvgArrowTriangleBottom;
