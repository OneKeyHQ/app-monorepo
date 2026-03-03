import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCalendarEdit = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="m23.414 16-6 6H14v-3.414l6-6zM16 19.414V20h.586l4-4-.586-.586z"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M9 4h6V2h2v2h4v7h-2v-1H5v9h7v2H3V4h4V2h2zM5 8h14V6H5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCalendarEdit;
