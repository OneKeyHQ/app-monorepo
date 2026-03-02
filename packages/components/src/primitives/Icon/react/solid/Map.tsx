import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMap = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m8 18.637-6 2V5.53l6-2zm6-13.774V19.97l-4-1.334V3.53zm8 13.108-6 2V4.863l6-2V17.97Z" />
  </Svg>
);
export default SvgMap;
