import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCalendar3Remove = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M9 2v2h6V2h2v2h4v17H3V4h4V2zm3 9.088L9.748 8.836 8.334 10.25l2.252 2.252-2.25 2.25 1.414 1.414 2.25-2.25 2.25 2.25 1.414-1.414-2.25-2.25 2.252-2.252-1.414-1.414z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCalendar3Remove;
