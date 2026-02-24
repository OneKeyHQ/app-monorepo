import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgOfficeBuilding = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M15 3v15h1V7h5v11h2v2H1v-2h2V3zM7 14h4v-2H7zm0-4h4V8H7z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgOfficeBuilding;
