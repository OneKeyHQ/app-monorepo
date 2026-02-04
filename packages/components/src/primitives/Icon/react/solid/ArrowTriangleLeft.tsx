import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowTriangleLeft = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M17.11 4.213C18.462 3.54 20 4.547 20 6.02v11.96c0 1.472-1.539 2.479-2.89 1.806L5.114 13.805c-1.484-.74-1.484-2.87 0-3.61l11.998-5.982Z" />
  </Svg>
);
export default SvgArrowTriangleLeft;
