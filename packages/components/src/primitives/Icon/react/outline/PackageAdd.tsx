import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPackageAdd = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M17 20v-2h-2a1 1 0 1 1 0-2h2v-2a1 1 0 1 1 2 0v2h2a1 1 0 1 1 0 2h-2v2a1 1 0 1 1-2 0m2-10V5h-3v3a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V5H5v14h6a1 1 0 1 1 0 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a1 1 0 1 1-2 0m-5-5h-4v3h4z" />
  </Svg>
);
export default SvgPackageAdd;
