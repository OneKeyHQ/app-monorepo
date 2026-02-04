import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronLeftSmall = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12.91 7.378a.982.982 0 0 1 1.388 1.389L11.065 12l3.233 3.233a.982.982 0 0 1-1.388 1.388l-3.407-3.406a1.72 1.72 0 0 1 0-2.43z" />
  </Svg>
);
export default SvgChevronLeftSmall;
