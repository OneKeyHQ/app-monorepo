import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgRewindBackward = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4.52 12 10 16.797V7.204zm8 0L18 16.797V7.204zM20 16.797c0 1.718-2.024 2.636-3.317 1.505L12 14.204v2.593c0 1.718-2.024 2.636-3.317 1.505l-5.482-4.796a2 2 0 0 1 0-3.01l5.482-4.797C9.977 4.568 12 5.486 12 7.204v2.592l4.683-4.097C17.977 4.568 20 5.486 20 7.204z" />
  </Svg>
);
export default SvgRewindBackward;
