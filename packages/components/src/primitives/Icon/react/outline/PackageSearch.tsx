import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPackageSearch = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M14.172 14.172a4 4 0 0 1 6.274 4.86l1.261 1.261a1 1 0 1 1-1.414 1.414l-1.26-1.26a4.001 4.001 0 0 1-4.861-6.275m4.242 1.414a2 2 0 1 0-2.828 2.828 2 2 0 0 0 2.828-2.828M19 10V5h-3v3a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V5H5v14h5a1 1 0 1 1 0 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a1 1 0 1 1-2 0m-5-5h-4v3h4z" />
  </Svg>
);
export default SvgPackageSearch;
