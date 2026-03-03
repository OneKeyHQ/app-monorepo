import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLayoutDashboard = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21 21H3V3h18zm-8-2h6v-4h-6zm-8-8v8h6v-8zm8 2h6V5h-6zM5 9h6V5H5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgLayoutDashboard;
