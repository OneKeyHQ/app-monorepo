import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChecklistBox = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M5 5v14h14V5zm4.74 8.153a1 1 0 0 1 1.6 1.2L9.468 16.85a1 1 0 0 1-1.355.232l-1.125-.75a1 1 0 0 1 1.11-1.664l.337.225 1.304-1.739ZM16 14a1 1 0 1 1 0 2h-2a1 1 0 1 1 0-2zM9.74 7.152a1 1 0 0 1 1.6 1.2l-1.872 2.496a1 1 0 0 1-1.355.232l-1.125-.75a1 1 0 0 1 1.11-1.664l.337.225 1.304-1.739ZM16.057 8a1 1 0 1 1 0 2h-2a1 1 0 0 1 0-2zM21 19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgChecklistBox;
