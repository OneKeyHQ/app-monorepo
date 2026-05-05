import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLayoutGrid2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M11 21H3v-8h8zm-6-2h4v-4H5zm16 2h-8v-8h8zm-6-2h4v-4h-4zm-4-8H3V3h8zM5 9h4V5H5zm16 2h-8V3h8zm-6-2h4V5h-4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgLayoutGrid2;
