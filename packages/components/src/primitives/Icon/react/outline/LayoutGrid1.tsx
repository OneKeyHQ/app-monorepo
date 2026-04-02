import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLayoutGrid1 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M11 21H3V11h8zm-6-2h4v-6H5zm16 2h-8v-6h8zm-6-2h4v-2h-4zm6-6h-8V3h8zm-6-2h4V5h-4zm-4-2H3V3h8zM5 7h4V5H5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgLayoutGrid1;
