import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMultipleDevices = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M14 10v10h7V10zm4 7a1 1 0 1 1 0 2h-1a1 1 0 1 1 0-2zm-6 2v-2H3v2zM5 5v10h7v-5a2 2 0 0 1 2-2h5V5zm16 3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-7c-.74 0-1.384-.403-1.73-1H3a2 2 0 0 1-2-2v-3a1 1 0 0 1 1-1h1V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgMultipleDevices;
