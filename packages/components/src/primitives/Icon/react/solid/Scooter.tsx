import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgScooter = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M14 4a1 1 0 1 0 0 2h1.68l1.455 7.276a3.51 3.51 0 0 0-1.99 2.224h-6.29A3.502 3.502 0 0 0 2 16.5a3.5 3.5 0 0 0 6.855 1h6.29a3.502 3.502 0 0 0 6.855-1 3.5 3.5 0 0 0-2.869-3.443l-1.49-7.45A2 2 0 0 0 15.681 4z" />
  </Svg>
);
export default SvgScooter;
