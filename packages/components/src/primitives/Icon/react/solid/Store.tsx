import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgStore = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15.558 10.293A4.51 4.51 0 0 0 19.095 12c.684 0 1.329-.15 1.905-.419V21h-7v-5.5h-4V21H3v-9.419c.576.268 1.22.419 1.904.419a4.51 4.51 0 0 0 3.538-1.707A4.55 4.55 0 0 0 12 12a4.55 4.55 0 0 0 3.558-1.707M7.75 3l-.333 4.66a2.52 2.52 0 1 1-5.007-.535L3 3zm6.5 0 .304 4.257a2.56 2.56 0 1 1-5.109 0L9.75 3zM21 3l.589 4.125a2.519 2.519 0 1 1-5.006.535L16.25 3z" />
  </Svg>
);
export default SvgStore;
