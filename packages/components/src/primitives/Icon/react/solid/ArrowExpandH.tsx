import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowExpandH = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M17.214 7.363a.985.985 0 0 1 1.393 0l3.94 3.94a.985.985 0 0 1 0 1.393l-3.94 3.94a.985.985 0 0 1-1.393-1.392l2.259-2.259H4.527l2.259 2.259a.985.985 0 1 1-1.393 1.393l-3.94-3.94a.985.985 0 0 1 0-1.393l3.94-3.94a.985.985 0 1 1 1.393 1.392l-2.259 2.259h14.946l-2.26-2.259a.985.985 0 0 1 0-1.393Z" />
  </Svg>
);
export default SvgArrowExpandH;
