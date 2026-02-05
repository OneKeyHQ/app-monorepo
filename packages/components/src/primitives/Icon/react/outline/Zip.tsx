import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgZip = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M3 19V5a2 2 0 0 1 2-2h1a1 1 0 0 1 0 2H5v14h14V5h-1a1 1 0 1 1 0-2h1a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2m10-6h-2v1a1 1 0 1 0 2 0zm1-6a1 1 0 1 1 0 2h-4a1 1 0 0 1 0-2zm0-4a1 1 0 1 1 0 2h-4a1 1 0 0 1 0-2zm1 11a3 3 0 1 1-6 0v-2a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1z" />
  </Svg>
);
export default SvgZip;
