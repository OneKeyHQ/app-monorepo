import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgHomeOpen = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13.283 2.127a1.99 1.99 0 0 0-2.566 0L3.753 8.003a1.99 1.99 0 0 0-.707 1.52v9.487c0 1.1.89 1.99 1.99 1.99H8.02a1.99 1.99 0 0 0 1.99-1.99v-4.974h3.98v4.974c0 1.1.89 1.99 1.99 1.99h2.984a1.99 1.99 0 0 0 1.99-1.99V9.523a1.99 1.99 0 0 0-.707-1.52z" />
  </Svg>
);
export default SvgHomeOpen;
