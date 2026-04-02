import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCalendar3Add = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M9 2v2h6V2h2v2h4v17H3V4h4V2zm1.999 9.5H8.5v2h2.499V16h2v-2.5H15.5v-2h-2.501V9h-2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCalendar3Add;
