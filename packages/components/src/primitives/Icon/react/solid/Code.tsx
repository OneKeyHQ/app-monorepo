import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCode = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21 21H3V3h18zM6.086 12l3.707 3.707 1.414-1.414L8.914 12l2.293-2.293-1.414-1.414zm6.707-2.293L15.086 12l-2.293 2.293 1.414 1.414L17.914 12l-3.707-3.707z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCode;
