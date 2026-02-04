import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPackageRemove = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M19.914 14.672a1 1 0 1 1 1.414 1.414L19.914 17.5l1.414 1.414a1 1 0 1 1-1.414 1.414L18.5 18.914l-1.414 1.414a1 1 0 1 1-1.414-1.414l1.414-1.414-1.414-1.414a1 1 0 1 1 1.414-1.414l1.414 1.414zM19 11V5h-3v3a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V5H5v14h7a1 1 0 1 1 0 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 1 1-2 0m-5-6h-4v3h4z" />
  </Svg>
);
export default SvgPackageRemove;
