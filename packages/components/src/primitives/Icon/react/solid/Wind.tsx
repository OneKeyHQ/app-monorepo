import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgWind = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15 15a3 3 0 1 1-2.121 5.121l-.707-.707L13.586 18l.707.707A1 1 0 1 0 15 17H2v-2zm4-8a3 3 0 1 1 0 6H2v-2h17a1 1 0 1 0-.707-1.707l-.707.707-1.414-1.414.707-.707A3 3 0 0 1 19 7" />
    <Path d="M11 3a3 3 0 1 1 0 6H2V7h9a1 1 0 1 0-.707-1.707L9.586 6 8.172 4.586l.707-.707A3 3 0 0 1 11 3" />
  </Svg>
);
export default SvgWind;
