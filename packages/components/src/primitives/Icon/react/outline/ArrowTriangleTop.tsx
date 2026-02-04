import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowTriangleTop = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M10.195 5.114c.74-1.483 2.87-1.483 3.61 0l5.983 11.995c.673 1.35-.334 2.89-1.805 2.89H6.018c-1.472 0-2.48-1.54-1.806-2.89zm1.79.889L6.003 17.995l.003.003.012.001h11.965l.011-.001.002-.003-5.98-11.988-.002-.004L12 6l-.015.002Z" />
  </Svg>
);
export default SvgArrowTriangleTop;
