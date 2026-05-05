import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgRocketLaunch = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M22.001 3c0 4.24-2.067 7.413-5 10.185v5.433l-7 3.5v-4.704L6.587 14H1.883l3.5-7h5.432c2.773-2.933 5.946-5 10.186-5h1zm-10 14.462v1.42l3-1.5v-2.47zM5.119 12h1.42l2.55-3h-2.47z"
      clipRule="evenodd"
    />
    <Path d="M5.001 16a3 3 0 1 1 0 6h-3v-3a3 3 0 0 1 3-3" />
  </Svg>
);
export default SvgRocketLaunch;
