import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFileGraph = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M7.5 17.5V16a1 1 0 1 1 2 0v1.5a1 1 0 1 1-2 0m3.5 0V13a1 1 0 1 1 2 0v4.5a1 1 0 1 1-2 0m3.5 0V15a1 1 0 1 1 2 0v2.5a1 1 0 1 1-2 0M20 20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h7l.099.005a1 1 0 0 1 .608.288l6 6A1 1 0 0 1 20 9zM16.586 8 14 5.414V8zM6 20h12V10h-4a2 2 0 0 1-2-2V4H6z" />
  </Svg>
);
export default SvgFileGraph;
