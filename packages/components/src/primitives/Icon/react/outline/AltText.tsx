import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAltText = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M19 15H5v4h14zm-7 1a1 1 0 1 1 0 2H7a1 1 0 1 1 0-2zm5 0a1 1 0 1 1 0 2h-2a1 1 0 1 1 0-2zM5 12.414V13h6.586L8 9.414zM16 8.5a.5.5 0 1 0-1 0 .5.5 0 0 0 1 0M5 5v4.586L6.586 8a2 2 0 0 1 2.828 0l5 5H19V5zm13 3.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0M21 19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgAltText;
