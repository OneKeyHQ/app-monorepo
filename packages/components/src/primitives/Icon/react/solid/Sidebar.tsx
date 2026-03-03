import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSidebar = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M7 14a1.25 1.25 0 1 1 0 2.5A1.25 1.25 0 0 1 7 14m0-3.25a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5M7 7.5A1.25 1.25 0 1 1 7 10a1.25 1.25 0 0 1 0-2.5" />
    <Path fillRule="evenodd" d="M22 4v16H2V4zM4 6v12h6V6z" clipRule="evenodd" />
  </Svg>
);
export default SvgSidebar;
