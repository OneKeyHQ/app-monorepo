import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgExpandWindow = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M10 12.5a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2z" />
    <Path d="M20 2.5a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-5a1 1 0 1 1 0-2h5v-9H5v5a1 1 0 1 1-2 0v-5a2 2 0 0 1 2-2z" />
    <Path d="M17 6.5a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0v-.586l-1.293 1.293a1 1 0 1 1-1.414-1.414L14.586 8.5H14a1 1 0 1 1 0-2z" />
  </Svg>
);
export default SvgExpandWindow;
