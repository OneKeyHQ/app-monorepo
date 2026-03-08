import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPackage = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M17 17h-4v-2h4z" />
    <Path
      fillRule="evenodd"
      d="M21 21H3V3h18zM5 19h14V5h-3v5H8V5H5zm5-11h4V5h-4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPackage;
