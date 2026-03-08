import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgRandomCrossover = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M22.414 17 18 21.414 16.586 20l2-2h-3l-3-3L14 13.586 16.414 16h2.172l-2-2L18 12.586z" />
    <Path d="M22.414 7 18 11.414 16.586 10l2-2h-2.172l-11 11H2v-2h2.586l11-11h3l-2-2L18 2.586zm-13 2L8 10.414 4.586 7H2V5h3.414z" />
  </Svg>
);
export default SvgRandomCrossover;
