import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBnoozeBell = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M9.174 18a2.998 2.998 0 0 0 5.652 0zM12 4a5.307 5.307 0 0 0-5.3 5.042l-.191 3.799a2 2 0 0 1-.208.794L5.118 16h13.764l-1.183-2.365a2 2 0 0 1-.208-.794l-.19-3.799A5.307 5.307 0 0 0 12 4m1.5 3.5a1 1 0 0 1 .8 1.6l-1.801 2.4H13.5a1 1 0 1 1 0 2h-3a1 1 0 0 1-.8-1.6l1.801-2.4H10.5a1 1 0 0 1 0-2zm7.5 8.691c0 1-.81 1.809-1.809 1.809H16.9a5.001 5.001 0 0 1-9.798 0H4.809a1.81 1.81 0 0 1-1.8-1.624L3 16.191l.012-.21q.037-.314.18-.6l1.32-2.64.19-3.799a7.308 7.308 0 0 1 14.597 0l.19 3.798 1.32 2.642c.125.251.191.529.191.81Z" />
  </Svg>
);
export default SvgBnoozeBell;
