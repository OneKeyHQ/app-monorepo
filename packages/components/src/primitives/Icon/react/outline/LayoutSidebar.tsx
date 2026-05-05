import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLayoutSidebar = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21 3v18H3V3zM11 13v6h8v-6zm-6 6h4V5H5zm6-8h8V5h-8z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgLayoutSidebar;
