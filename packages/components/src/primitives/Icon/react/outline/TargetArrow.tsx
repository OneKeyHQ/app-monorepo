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
    <Path
      fillRule="evenodd"
      d="m19.29 4.709 4.062 1.354L18.414 11h-4l-2.207 2.207-1.414-1.414L13 9.586v-4L17.938.648 19.29 4.71ZM15 6.414V9h2.586l2.062-2.063-1.464-.489-.475-.157-.157-.475-.49-1.465z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgTargetArrow;
