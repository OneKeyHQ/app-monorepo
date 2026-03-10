import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCalendarDays = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21 3v18H3V3zM7 17h2v-2H7zm4-2v2h2v-2zm-4-2h2v-2H7zm4 0h2v-2h-2zm4-2v2h2v-2zM5 7h14V5H5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCalendarDays;
