import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCup1 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15 5H5v14h10zm2 3v4h2V8zm4 4a2 2 0 0 1-2 2h-2v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v2h2a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgCup1;
