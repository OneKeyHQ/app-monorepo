import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronTriangleUpSmall = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 18 18" accessibilityRole="image" {...props}>
    <Path
      fill="#000"
      fillOpacity={0.447}
      d="M10.858 10.688c.936 0 1.463-1.077.888-1.816l-1.858-2.39a1.125 1.125 0 0 0-1.776 0l-1.858 2.39a1.125 1.125 0 0 0 .888 1.816z"
    />
  </Svg>
);
export default SvgChevronTriangleUpSmall;
