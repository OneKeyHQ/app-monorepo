import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBell = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M9 17a3 3 0 0 0 6 0h2a5 5 0 0 1-10 0z" />
    <Path d="M12 4a5.307 5.307 0 0 0-5.3 5.042l-.191 3.799a2 2 0 0 1-.208.794L5.118 16h13.764l-1.183-2.365a2 2 0 0 1-.208-.794l-.19-3.799A5.307 5.307 0 0 0 12 4m9 12.191c0 1-.81 1.809-1.809 1.809H4.81a1.81 1.81 0 0 1-1.8-1.624L3 16.191l.012-.21a1.8 1.8 0 0 1 .18-.6l1.32-2.64.19-3.799a7.308 7.308 0 0 1 14.597 0l.19 3.798 1.32 2.642.083.193c.071.197.108.406.108.616" />
  </Svg>
);
export default SvgBell;
