import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgItalic = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 5h-4.765L10.86 19H15v2H4v-2h4.765L13.14 5H9V3h11z" />
  </Svg>
);
export default SvgItalic;
