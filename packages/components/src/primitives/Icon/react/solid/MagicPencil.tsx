import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMagicPencil = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11.361 3.054a1.032 1.032 0 0 0-1.698.865l.334 4.334-3.702 2.277a1.032 1.032 0 0 0 .298 1.882l3.049.737-6.722 6.723a1.032 1.032 0 0 0 1.46 1.46l6.722-6.723.737 3.05a1.032 1.032 0 0 0 1.883.297l2.276-3.702 4.333.334a1.032 1.032 0 0 0 .866-1.698l-2.818-3.31 1.657-4.017a1.032 1.032 0 0 0-1.348-1.348L14.67 5.872z" />
  </Svg>
);
export default SvgMagicPencil;
