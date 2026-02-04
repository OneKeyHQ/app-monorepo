import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCc = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm11.543 6.293a1 1 0 0 1 1.414 0 1 1 0 0 0 1.414-1.414 3 3 0 1 0 0 4.242 1 1 0 0 0-1.414-1.414 1 1 0 0 1-1.414-1.414m-6 0a1 1 0 0 1 1.414 0 1 1 0 0 0 1.414-1.414 3 3 0 1 0 0 4.243 1 1 0 0 0-1.414-1.415 1 1 0 0 1-1.414-1.414"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCc;
