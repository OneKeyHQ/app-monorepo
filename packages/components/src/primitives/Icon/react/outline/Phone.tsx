import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPhone = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15 20H9v-2h6z" />
    <Path
      fillRule="evenodd"
      d="M19 23H5V1h14zM7 21h10V3H7z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPhone;
