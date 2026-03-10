import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPackage = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M8 10h8V3h5v18H3V3h5zm6 8h4v-2h-4z"
      clipRule="evenodd"
    />
    <Path d="M14 8h-4V3h4z" />
  </Svg>
);
export default SvgPackage;
