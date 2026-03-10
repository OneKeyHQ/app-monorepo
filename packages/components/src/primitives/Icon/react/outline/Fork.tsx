import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFork = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M18 3a2.998 2.998 0 0 1 1 5.825V13h-6v2.174A2.998 2.998 0 0 1 12 21a3 3 0 0 1-1-5.826V13H5V8.825A2.998 2.998 0 0 1 6 3a2.998 2.998 0 0 1 1 5.825V11h10V8.825A2.998 2.998 0 0 1 18 3m-6 14a1 1 0 1 0 0 2 1 1 0 0 0 0-2M6 5a1 1 0 1 0 0 2 1 1 0 0 0 0-2m12 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFork;
