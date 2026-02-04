import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPackage = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M16 5v3a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V5H5v14h14V5zm0 10a1 1 0 1 1 0 2h-2a1 1 0 1 1 0-2zM14 5h-4v3h4zm7 14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgPackage;
