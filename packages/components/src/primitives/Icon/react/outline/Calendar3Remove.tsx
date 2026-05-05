import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCalendar3Remove = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m15.666 10.25-2.253 2.253 2.25 2.249-1.415 1.414-2.249-2.249-2.249 2.249-1.414-1.414 2.249-2.25-2.253-2.252 1.414-1.414L12 11.089l2.253-2.253z" />
    <Path
      fillRule="evenodd"
      d="M9 4h6V2h2v2h4v17H3V4h4V2h2zM5 19h14V6H5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCalendar3Remove;
