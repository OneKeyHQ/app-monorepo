import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTargetArrow = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 2q.563 0 1.11.06l-.22 1.989a8 8 0 1 0 7.062 7.062l1.988-.221q.06.547.06 1.11c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2" />
    <Path d="M11.599 8.02a4 4 0 1 0 4.381 4.38l1.99.198A6.001 6.001 0 0 1 6 12a6 6 0 0 1 5.401-5.97z" />
    <Path d="m19.291 4.709 4.06 1.354L18.415 11h-4L12 13.414 10.586 12 13 9.586v-4L17.938.648 19.29 4.71Z" />
  </Svg>
);
export default SvgTargetArrow;
