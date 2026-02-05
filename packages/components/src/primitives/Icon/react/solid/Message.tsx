import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMessage = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20.002 3h-16a2 2 0 0 0-2 2v12.036a2 2 0 0 0 2 2h4.65l2.704 2.266a1 1 0 0 0 1.28.004l2.74-2.27h4.626a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2" />
  </Svg>
);
export default SvgMessage;
