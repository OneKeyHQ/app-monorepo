import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPackageAdd = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10.17c-.11-.313-.17-.65-.17-1a3 3 0 1 1 0-6 3 3 0 1 1 6 0V5a2 2 0 0 0-2-2h-3v4a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2z" />
    <Path d="M14 3h-4v4h4zm5 11a1 1 0 1 0-2 0v2h-2a1 1 0 1 0 0 2h2v2a1 1 0 1 0 2 0v-2h2a1 1 0 1 0 0-2h-2z" />
  </Svg>
);
export default SvgPackageAdd;
