import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowPathRight = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15.601 4.824c-.989-.815-2.48-.111-2.48 1.17v1.962H4.022A2.02 2.02 0 0 0 2 9.978v4.044c0 1.117.905 2.022 2.022 2.022h9.099v1.962c0 1.281 1.491 1.985 2.48 1.17l6.82-5.615a2.022 2.022 0 0 0 0-3.122L15.6 4.824Z" />
  </Svg>
);
export default SvgArrowPathRight;
