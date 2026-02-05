import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgUndock = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M6 20v-6a1 1 0 1 1 2 0v6h12V8h-6a1 1 0 1 1 0-2h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2M3 10V4.5A1.5 1.5 0 0 1 4.5 3H10a1 1 0 1 1 0 2H6.414l4.543 4.543a1 1 0 1 1-1.414 1.414L5 6.414V10a1 1 0 1 1-2 0" />
  </Svg>
);
export default SvgUndock;
