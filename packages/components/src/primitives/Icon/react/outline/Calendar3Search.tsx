import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCalendar3Search = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M11.75 8.25a3.75 3.75 0 0 1 3.262 5.598l1.402 1.402L15 16.664l-1.402-1.402A3.75 3.75 0 1 1 11.75 8.25m0 2a1.75 1.75 0 1 0 0 3.5 1.75 1.75 0 0 0 0-3.5"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M9 4h6V2h2v2h4v17H3V4h4V2h2zM5 19h14V6H5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCalendar3Search;
