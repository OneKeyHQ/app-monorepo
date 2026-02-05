import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChecklist = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M7.7 13.4a1 1 0 1 1 1.6 1.2l-3 4a1 1 0 0 1-1.355.232l-1.5-1a1 1 0 1 1 1.11-1.664l.713.474zM20 15a1 1 0 1 1 0 2h-7a1 1 0 0 1 0-2zM7.7 5.4a1 1 0 1 1 1.6 1.2l-3 4a1 1 0 0 1-1.355.232l-1.5-1a1 1 0 1 1 1.11-1.664l.713.475zM20 7a1 1 0 1 1 0 2h-7a1 1 0 1 1 0-2z" />
  </Svg>
);
export default SvgChecklist;
