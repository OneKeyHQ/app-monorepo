import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgExpandWindow = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 6a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1v4a1 1 0 1 1-2 0V6a3 3 0 0 1 3-3h13a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-4a1 1 0 1 1 0-2h4a1 1 0 0 0 1-1z" />
    <Path d="M9 13a3 3 0 0 1 3 3v3a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3v-3a3 3 0 0 1 3-3zm9-5a1 1 0 0 0-1-1h-3a1 1 0 1 0 0 2h.586l-1.293 1.293a1 1 0 0 0 1.414 1.414L16 10.414V11a1 1 0 1 0 2 0z" />
  </Svg>
);
export default SvgExpandWindow;
