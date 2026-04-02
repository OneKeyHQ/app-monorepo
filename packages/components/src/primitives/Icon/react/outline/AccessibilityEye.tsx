import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAccessibilityEye = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M9.968 8.554a3.998 3.998 0 0 1 5.476 5.476l6.97 6.97L21 22.414l-3.799-3.799c-1.02.57-2.091.967-3.185 1.185-4.886.973-9.943-1.616-12.905-7.341L.874 12l.237-.46a16.8 16.8 0 0 1 2.124-3.192 14 14 0 0 1 1.873-1.826L1.586 3 3 1.586zM4.087 10.5q-.502.694-.952 1.499c2.172 3.898 5.325 5.821 8.436 5.985zm2.445-2.555a11 11 0 0 0-1.151 1.02l8.752 8.752a9 9 0 0 0 1.586-.585zm6.882 2.64a2 2 0 0 0-1.932-.518l2.449 2.449a2 2 0 0 0-.517-1.931"
      clipRule="evenodd"
    />
    <Path d="M10.606 4.095c4.697-.643 9.448 1.967 12.282 7.445l.238.46-.238.459a17 17 0 0 1-1.806 2.808l-.624.782-1.563-1.247.623-.781q.721-.905 1.345-2.022c-2.537-4.553-6.412-6.411-9.985-5.923l-.991.136-.27-1.982.99-.135Z" />
  </Svg>
);
export default SvgAccessibilityEye;
