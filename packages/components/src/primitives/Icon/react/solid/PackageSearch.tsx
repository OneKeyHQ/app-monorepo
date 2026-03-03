import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPackageSearch = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M14.172 14.172a4 4 0 0 1 6.274 4.86L22.414 21 21 22.414l-1.968-1.968a4.001 4.001 0 0 1-4.86-6.274m4.242 1.414a2 2 0 1 0-2.828 2.828 2 2 0 0 0 2.828-2.828"
      clipRule="evenodd"
    />
    <Path d="M8 9h8V3h5v9.527A6 6 0 0 0 12.527 21H3V3h5z" />
    <Path d="M14 7h-4V3h4z" />
  </Svg>
);
export default SvgPackageSearch;
