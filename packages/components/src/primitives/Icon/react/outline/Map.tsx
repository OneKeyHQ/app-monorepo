import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMap = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15.987 6.986v10.856l3.988-1.327V5.657zm-5.98 9.527 3.987 1.33V6.985l-3.987-1.33v10.857Zm-5.981 1.33 3.987-1.33V5.658l-3.987 1.33v10.856Zm17.942-1.328c0 .857-.549 1.619-1.363 1.89l-4.984 1.662a2 2 0 0 1-1.261 0l-5.35-1.784-4.353 1.452a1.994 1.994 0 0 1-2.625-1.892V6.986c0-.857.55-1.62 1.363-1.89l4.984-1.663c.41-.136.852-.136 1.262 0l5.35 1.784 4.353-1.452a1.994 1.994 0 0 1 2.624 1.892z" />
  </Svg>
);
export default SvgMap;
