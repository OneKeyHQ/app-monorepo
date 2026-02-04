import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgToast = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 3c-2.623 0-5.046.588-6.85 1.59C3.38 5.573 2 7.091 2 9c0 1.47.826 2.713 2 3.647V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6.353c1.174-.934 2-2.177 2-3.647 0-1.909-1.38-3.427-3.15-4.41C17.046 3.588 14.622 3 12 3" />
  </Svg>
);
export default SvgToast;
