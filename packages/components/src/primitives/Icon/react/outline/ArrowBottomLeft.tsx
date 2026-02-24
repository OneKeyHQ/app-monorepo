import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowBottomLeft = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M19.164 6.25 8.414 17H16v2H5V8h2v7.586l10.75-10.75z" />
  </Svg>
);
export default SvgArrowBottomLeft;
