import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSpeedFast = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M14.105 9.553a1 1 0 0 1 1.79.894L13.617 15h5.798a8 8 0 1 0-14.832 0h6.798l2.723-5.447ZM5.757 17A7.98 7.98 0 0 0 12 20a7.98 7.98 0 0 0 6.243-3zM22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10" />
  </Svg>
);
export default SvgSpeedFast;
