import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCopy2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M10 8h6v6h1v2h-1v6H2V8h6V7h2zm12 4v4h-4v-2h2v-2zm0-1h-2V7h2zM12 4h-2v2H8V2h4zm10 2h-2V4h-2V2h4zm-5-2h-4V2h4z" />
  </Svg>
);
export default SvgCopy2;
