import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPackageSearch = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7.528A6 6 0 0 1 21 12.528V5a2 2 0 0 0-2-2h-3v4a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2z" />
    <Path d="M14 3h-4v4h4z" />
    <Path
      fillRule="evenodd"
      d="M19.828 14.172a4 4 0 1 0-.796 6.274l1.26 1.261a1 1 0 0 0 1.415-1.414l-1.26-1.26a4 4 0 0 0-.619-4.861m-4.242 1.414a2 2 0 1 1 2.828 2.828 2 2 0 0 1-2.828-2.828"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPackageSearch;
