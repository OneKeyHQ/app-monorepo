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
    <Path
      fillRule="evenodd"
      d="M9 4h6V2h2v2h4v8h-2v-2H5v9h7v2H3V4h4V2h2zM5 8h14V6H5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCalendarFailur;
