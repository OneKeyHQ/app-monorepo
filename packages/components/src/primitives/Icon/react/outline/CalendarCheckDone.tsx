import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCalendarCheckDone = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m22.405 15.844-5.322 6.653L13.586 19 15 17.586l1.916 1.916 3.928-4.907z" />
    <Path
      fillRule="evenodd"
      d="M9 4h6V2h2v2h4v9h-2v-3H5v9h7v2H3V4h4V2h2zM5 8h14V6H5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCalendarCheckDone;
