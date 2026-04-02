import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgToast = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 3c2.622 0 5.046.588 6.85 1.59C20.62 5.573 22 7.09 22 9c0 1.47-.826 2.713-2 3.646V21H4v-8.354C2.826 11.713 2 10.47 2 9c0-1.909 1.38-3.427 3.15-4.41C6.954 3.588 9.378 3 12 3" />
  </Svg>
);
export default SvgToast;
