import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSunset = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M18 21H6v-2h12zm5-4H1v-2h22zM12 3a9 9 0 0 1 9 9v1H3v-1a9 9 0 0 1 9-9" />
  </Svg>
);
export default SvgSunset;
