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
      d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm7.707 3.793a1 1 0 0 1 0 1.414L8.914 12l1.793 1.793a1 1 0 0 1-1.414 1.414L7.5 13.414a2 2 0 0 1 0-2.828l1.793-1.793a1 1 0 0 1 1.414 0m4 0a1 1 0 1 0-1.414 1.414L15.086 12l-1.793 1.793a1 1 0 0 0 1.414 1.414l1.793-1.793a2 2 0 0 0 0-2.828z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCode;
