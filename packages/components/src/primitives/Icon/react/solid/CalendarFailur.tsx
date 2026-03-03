import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCalendarFailur = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m21.414 16-2 2 2 2L20 21.414l-2-2-2 2L14.586 20l2-2-2-2L16 14.586l2 2 2-2z" />
    <Path d="M9 2v2h6V2h2v2h4v8h-2v-2H5v9h7v2H3V4h4V2z" />
  </Svg>
);
export default SvgCalendarFailur;
