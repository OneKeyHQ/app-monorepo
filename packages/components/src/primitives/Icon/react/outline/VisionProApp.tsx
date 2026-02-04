import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgVisionProApp = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M18 17H8v1h10zM0 13V9a1 1 0 0 1 2 0v4a1 1 0 1 1-2 0m5-7v10h1.27c.345-.597.99-1 1.73-1h10c.74 0 1.384.403 1.73 1H21V6zm18 10a2 2 0 0 1-2 2h-1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgVisionProApp;
