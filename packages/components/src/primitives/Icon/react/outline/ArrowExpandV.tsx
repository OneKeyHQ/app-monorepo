import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowExpandV = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 1.164c.261 0 .512.104.697.289l3.94 3.94a.985.985 0 0 1-1.393 1.393l-2.259-2.259v14.946l2.259-2.26a.985.985 0 1 1 1.393 1.394l-3.94 3.94a.985.985 0 0 1-1.393 0l-3.94-3.94a.985.985 0 1 1 1.392-1.393l2.259 2.259V4.527L8.756 6.786a.985.985 0 1 1-1.393-1.393l3.94-3.94.073-.066A1 1 0 0 1 12 1.164" />
  </Svg>
);
export default SvgArrowExpandV;
