import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMinimizeWindow = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4 14.5v5h6v-5zm16-1v-9H5v5a1 1 0 1 1-2 0v-5a2 2 0 0 1 2-2h15a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-5a1 1 0 1 1 0-2zm-3.707-6.707a1 1 0 1 1 1.414 1.414L16.414 9.5H17a1 1 0 1 1 0 2h-3a1 1 0 0 1-1-1v-3a1 1 0 1 1 2 0v.586zM12 19.5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgMinimizeWindow;
