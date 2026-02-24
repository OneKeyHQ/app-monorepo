import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAlighRight = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M22 20h-2V4h2zm-3.586-8-5.664 5.664-1.414-1.414 3.25-3.25H2v-2h12.586l-3.25-3.25 1.414-1.414z" />
  </Svg>
);
export default SvgAlighRight;
