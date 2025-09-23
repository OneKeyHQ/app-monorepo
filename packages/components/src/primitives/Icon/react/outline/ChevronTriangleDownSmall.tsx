import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronTriangleDownSmall = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 18 18" accessibilityRole="image" {...props}>
    <Path
      fill="#000"
      fillOpacity={0.447}
      d="M7.142 7.313a1.125 1.125 0 0 0-.888 1.815l1.858 2.39c.45.579 1.326.579 1.776 0l1.858-2.39a1.125 1.125 0 0 0-.888-1.815z"
    />
  </Svg>
);
export default SvgChevronTriangleDownSmall;
