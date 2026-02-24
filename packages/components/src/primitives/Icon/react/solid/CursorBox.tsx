import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCursorBox = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m23.455 14.144-5.73 3.582-3.581 5.73-3.582-12.893 12.893 3.58Z" />
    <Path d="M21 11h-2V5H5v14h6v2H3V3h18z" />
  </Svg>
);
export default SvgCursorBox;
