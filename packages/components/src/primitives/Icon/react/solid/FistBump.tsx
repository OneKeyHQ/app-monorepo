import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFistBump = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M5.22 9a2.21 2.21 0 0 1 1.837.982l.256.387c.055.082.147.13.246.131a3.884 3.884 0 0 1 3.867 4.246l-.162 1.726A3.89 3.89 0 0 1 7.39 20H1v-8h.75c.454 0 .863-.273 1.038-.692l.397-.95A2.21 2.21 0 0 1 5.22 9m13.502 0c.89 0 1.694.535 2.037 1.357l.395.95c.175.42.585.693 1.04.693h.75v8h-6.39a3.89 3.89 0 0 1-3.875-3.528l-.161-1.726a3.883 3.883 0 0 1 3.866-4.246.3.3 0 0 0 .245-.13l.258-.388A2.2 2.2 0 0 1 18.722 9m-.367-3.412-2.572 3.064-1.148-.964 2.571-3.064zm-9 2.1-1.149.963-2.571-3.063 1.15-.965 2.57 3.064ZM12.751 7h-1.5V3h1.5z" />
  </Svg>
);
export default SvgFistBump;
