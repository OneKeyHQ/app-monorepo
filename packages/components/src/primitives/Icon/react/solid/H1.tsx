import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgH1 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4 11h8V4h2v16h-2v-7H4v7H2V4h2zm18 9h-2v-7.086l-2 2-1.414-1.414 3.5-3.5H22z" />
  </Svg>
);
export default SvgH1;
