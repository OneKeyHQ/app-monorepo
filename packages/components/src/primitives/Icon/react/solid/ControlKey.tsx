import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgControlKey = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm11.707 2.293a1 1 0 0 0-1.414 0l-2 2a1 1 0 0 0 1.414 1.414L14 9.414l1.293 1.293a1 1 0 0 0 1.414-1.414z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgControlKey;
