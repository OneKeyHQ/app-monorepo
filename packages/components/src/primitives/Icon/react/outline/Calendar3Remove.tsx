import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCalendar3Remove = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13.545 10.043a1 1 0 0 1 1.414 1.414l-1.546 1.546 1.542 1.542a1 1 0 0 1-1.414 1.414l-1.542-1.542-1.542 1.542a1 1 0 0 1-1.414-1.414l1.542-1.542-1.546-1.546a1 1 0 1 1 1.414-1.414L12 11.589z" />
    <Path
      fillRule="evenodd"
      d="M16 2.5a1 1 0 0 1 1 1v1h2a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2h2v-1a1 1 0 0 1 2 0v1h6v-1a1 1 0 0 1 1-1m-11 17h14v-13H5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCalendar3Remove;
