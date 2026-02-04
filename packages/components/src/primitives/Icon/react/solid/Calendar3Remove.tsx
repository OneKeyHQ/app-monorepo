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
      d="M8 2.5a1 1 0 0 1 1 1v1h6v-1a1 1 0 1 1 2 0v1h2a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2h2v-1a1 1 0 0 1 1-1m2.455 7.543a1 1 0 1 0-1.414 1.414l1.545 1.545-1.543 1.543a1 1 0 1 0 1.414 1.414L12 14.416l1.543 1.543a1 1 0 0 0 1.414-1.414l-1.543-1.543 1.545-1.545a1 1 0 0 0-1.414-1.414L12 11.588z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCalendar3Remove;
