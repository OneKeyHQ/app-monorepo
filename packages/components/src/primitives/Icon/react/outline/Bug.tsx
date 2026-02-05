import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBug = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11 13a1 1 0 1 1 2 0v6.9a5 5 0 0 0 4-4.9V9H7v6a5 5 0 0 0 4 4.9zm4-6a3 3 0 1 0-6 0zm2.204.01a2 2 0 0 1 1.345.726l1.86-.675a1 1 0 1 1 .683 1.878L19 9.7V12h2a1 1 0 1 1 0 2h-2v1c0 .43-.042.85-.116 1.258l2.208.803a1 1 0 1 1-.684 1.878l-2.16-.786a6.997 6.997 0 0 1-12.497 0l-2.16.787a1 1 0 1 1-.683-1.88l2.207-.802A7 7 0 0 1 5 15v-1H3a1 1 0 1 1 0-2h2V9.7l-2.092-.76a1 1 0 1 1 .684-1.88l1.858.676c.327-.4.804-.67 1.346-.725L7 7a5 5 0 0 1 10 0z" />
  </Svg>
);
export default SvgBug;
