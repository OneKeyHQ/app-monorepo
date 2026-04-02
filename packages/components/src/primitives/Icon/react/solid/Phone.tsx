import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPhone = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M19 23H5V1h14zM9 20h6v-2H9z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPhone;
