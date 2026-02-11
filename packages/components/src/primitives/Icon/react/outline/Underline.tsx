import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgUnderline = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M18 20a1 1 0 1 1 0 2H6a1 1 0 1 1 0-2zM5 12V4a1 1 0 0 1 2 0v8a5 5 0 0 0 10 0V4a1 1 0 1 1 2 0v8a7 7 0 1 1-14 0" />
  </Svg>
);
export default SvgUnderline;
