import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFileText = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15.5 16a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2zM12 12a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2zm8 8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h7l.099.005a1 1 0 0 1 .608.288l6 6A1 1 0 0 1 20 9zM16.586 8 14 5.414V8zM6 20h12V10h-4a2 2 0 0 1-2-2V4H6z" />
  </Svg>
);
export default SvgFileText;
