import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTape = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M3 6v12h18V6zm10.379 3.879A3 3 0 1 1 15.5 15h-7a3 3 0 1 1 2.825-2h1.35a3 3 0 0 1 .704-3.121m2.828 1.414a1 1 0 1 0-1.414 1.413 1 1 0 0 0 1.414-1.413m-7 0a1 1 0 1 0-1.414 1.413 1 1 0 0 0 1.414-1.413M23 18a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h18a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgTape;
