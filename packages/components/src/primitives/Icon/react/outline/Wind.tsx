import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgWind = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M16 18a1 1 0 0 0-1-1H3a1 1 0 1 1 0-2h12a3 3 0 1 1-2.121 5.121 1 1 0 1 1 1.414-1.414A1 1 0 0 0 16 18m4-8a1 1 0 0 0-1.707-.707 1 1 0 0 1-1.414-1.414A3 3 0 1 1 19 13H3a1 1 0 1 1 0-2h16a1 1 0 0 0 1-1m-8-4a1 1 0 0 0-1.707-.707 1 1 0 0 1-1.414-1.414A3 3 0 1 1 11 9H3a1 1 0 0 1 0-2h8a1 1 0 0 0 1-1" />
  </Svg>
);
export default SvgWind;
