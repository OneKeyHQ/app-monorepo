import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBell = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 2a7.31 7.31 0 0 1 7.299 6.942l.19 3.798 1.32 2.642.083.193a1.809 1.809 0 0 1-1.7 2.425h-2.293a5.001 5.001 0 0 1-9.798 0H4.809a1.81 1.81 0 0 1-1.8-1.624L3 16.191l.012-.21a1.8 1.8 0 0 1 .18-.6l1.32-2.64.19-3.799A7.31 7.31 0 0 1 12 2M9.174 18c.412 1.165 1.52 2 2.826 2a3 3 0 0 0 2.826-2zM12 4a5.307 5.307 0 0 0-5.3 5.042l-.191 3.799a2 2 0 0 1-.208.794L5.118 16h13.764l-1.183-2.365a2 2 0 0 1-.208-.794l-.19-3.799A5.307 5.307 0 0 0 12 4"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBell;
