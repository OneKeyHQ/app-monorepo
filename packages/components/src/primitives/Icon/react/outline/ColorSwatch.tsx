import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgColorSwatch = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M10.837 2.181c.643 0 1.212.312 1.57.79a1 1 0 0 1 .393.126l4.693 2.71c.557.321.895.875.966 1.469q.167.118.277.306l2.71 4.694c.543.94.22 2.14-.719 2.682l-9.4 5.427a1 1 0 0 1-.408.127A5.4 5.4 0 0 1 2 16.419V4.144A1.965 1.965 0 0 1 3.965 2.18h6.873ZM7.4 14.946a1.473 1.473 0 1 1 0 2.945 1.473 1.473 0 0 1 0-2.945m5.915 2.024 6.43-3.712-2.143-3.713zm-.514-3.036 3.71-6.426-3.71-2.143zm-8.837 2.484a3.437 3.437 0 0 0 6.873 0V4.145H3.964z" />
  </Svg>
);
export default SvgColorSwatch;
