import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBranches = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M17.5 3a2.998 2.998 0 0 1 1 5.825V13h-11v2.174A2.998 2.998 0 0 1 6.5 21a3 3 0 0 1-1-5.826V8.825A2.998 2.998 0 0 1 6.5 3a2.998 2.998 0 0 1 1 5.825V11h9V8.825A2.998 2.998 0 0 1 17.5 3m-11 14a1 1 0 1 0 0 2 1 1 0 0 0 0-2m0-12a1 1 0 1 0 0 2 1 1 0 0 0 0-2m11 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBranches;
