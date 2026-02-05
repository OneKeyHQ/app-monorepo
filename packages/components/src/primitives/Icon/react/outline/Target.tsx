import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTarget = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11 22v-2.064A8 8 0 0 1 4.064 13H2a1 1 0 1 1 0-2h2.064A8 8 0 0 1 11 4.063V2a1 1 0 1 1 2 0v2.063A8 8 0 0 1 19.936 11H22a1 1 0 1 1 0 2h-2.064A8 8 0 0 1 13 19.936V22a1 1 0 1 1-2 0m0-14V6.084A6 6 0 0 0 6.085 11H8a1 1 0 1 1 0 2H6.085A6 6 0 0 0 11 17.915V16a1 1 0 1 1 2 0v1.915A6 6 0 0 0 17.915 13H16a1 1 0 1 1 0-2h1.915A6 6 0 0 0 13 6.084V8a1 1 0 1 1-2 0" />
  </Svg>
);
export default SvgTarget;
