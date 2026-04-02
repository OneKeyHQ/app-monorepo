import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFaceId = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M5 19h4v2H3v-6h2zm16 2h-6v-2h4v-4h2zm-4.634-4.937-.865.5A7 7 0 0 1 12 17.5a7 7 0 0 1-3.501-.938l-.865-.5 1-1.73.867.5A5 5 0 0 0 12 15.5a4.97 4.97 0 0 0 2.499-.668l.866-.5zM13.5 11a3 3 0 0 1-3 3v-2a1 1 0 0 0 1-1V8h2zM9 11H7V8h2zm8 0h-2V8h2zM9 5H5v4H3V3h6zm12 4h-2V5h-4V3h6z" />
  </Svg>
);
export default SvgFaceId;
