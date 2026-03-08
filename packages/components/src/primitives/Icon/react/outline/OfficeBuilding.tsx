import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgOfficeBuilding = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11 14H7v-2h4zm0-4H7V8h4z" />
    <Path
      fillRule="evenodd"
      d="M15 7h6v11h2v2H1v-2h2V3h12zM5 18h8V5H5zm10 0h4V9h-4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgOfficeBuilding;
