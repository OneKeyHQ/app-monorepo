import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTable = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21 3v18H3V3zm-10 8v8h8v-8zm-6 8h4v-8H5zm6-10h8V5h-8zM5 9h4V5H5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgTable;
