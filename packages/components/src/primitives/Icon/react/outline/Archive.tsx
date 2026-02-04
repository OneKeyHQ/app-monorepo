import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArchive = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M19 14h-2.417a5 5 0 0 1-9.166 0H5v5h14zM5 5v7h3.126a1 1 0 0 1 .969.751 3.001 3.001 0 0 0 5.81 0l.056-.16a1 1 0 0 1 .913-.591H19V5zm16 14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14l.204.01A2 2 0 0 1 21 5z" />
  </Svg>
);
export default SvgArchive;
