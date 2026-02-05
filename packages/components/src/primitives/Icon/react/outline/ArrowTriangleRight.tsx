import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowTriangleRight = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4.001 6.017c0-1.471 1.54-2.479 2.89-1.805l11.995 5.982c1.484.74 1.484 2.871 0 3.611L6.89 19.788C5.54 20.46 4 19.454 4 17.982V6.017Zm2 11.965.001.012.002.002 11.99-5.98.002-.002q.002-.004.003-.014 0-.011-.003-.015l-.003-.002-11.989-5.98-.002.003z" />
  </Svg>
);
export default SvgArrowTriangleRight;
