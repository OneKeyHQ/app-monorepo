import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBezierEdit = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M16.793 13.46a2.65 2.65 0 1 1 3.747 3.747l-3.5 3.5a1 1 0 0 1-.707.293H14a1 1 0 0 1-1-1v-2.333a1 1 0 0 1 .293-.707zm2.333 1.414a.65.65 0 0 0-.919 0L15 18.081V19h.92l3.206-3.207a.65.65 0 0 0 0-.919M5 19h2v-2H5zM17 7h2V5h-2zM5 7h2V5H5zm16 .5A1.5 1.5 0 0 1 19.5 9H19v1a1 1 0 1 1-2 0V9h-.5A1.5 1.5 0 0 1 15 7.5V7H9v.5A1.5 1.5 0 0 1 7.5 9H7v6h.5A1.5 1.5 0 0 1 9 16.5v.5h1a1 1 0 1 1 0 2H9v.5A1.5 1.5 0 0 1 7.5 21h-3A1.5 1.5 0 0 1 3 19.5v-3A1.5 1.5 0 0 1 4.5 15H5V9h-.5A1.5 1.5 0 0 1 3 7.5v-3A1.5 1.5 0 0 1 4.5 3h3A1.5 1.5 0 0 1 9 4.5V5h6v-.5A1.5 1.5 0 0 1 16.5 3h3A1.5 1.5 0 0 1 21 4.5z" />
  </Svg>
);
export default SvgBezierEdit;
