import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCalendarDays = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M9.01 17H7v-2h2.01zm4 0H11v-2h2.01zm-4-4H7v-2h2.01zm4 0H11v-2h2.01zm4 0H15v-2h2.01z" />
    <Path
      fillRule="evenodd"
      d="M21 21H3V3h18zM5 19h14V9H5zM5 7h14V5H5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCalendarDays;
