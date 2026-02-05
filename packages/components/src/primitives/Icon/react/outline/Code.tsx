import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCode = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M5 5v14h14V5zm4.293 3.793a1 1 0 1 1 1.414 1.414L8.914 12l1.793 1.793a1 1 0 1 1-1.414 1.414L7.5 13.414a2 2 0 0 1 0-2.828zm4 0a1 1 0 0 1 1.414 0l1.793 1.793a2 2 0 0 1 0 2.828l-1.793 1.793a1 1 0 1 1-1.414-1.414L15.086 12l-1.793-1.793a1 1 0 0 1 0-1.414M21 19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgCode;
