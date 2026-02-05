import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronTriangleUpSmall = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M14.478 8.907c1.209 0 1.906 1.348 1.252 2.327l-.068.094-2.477 3.186a1.5 1.5 0 0 1-2.369 0l-2.478-3.186c-.766-.985-.064-2.42 1.185-2.42zM12 12.778l1.456-1.87h-2.912L12 12.777Z" />
  </Svg>
);
export default SvgChevronTriangleUpSmall;
