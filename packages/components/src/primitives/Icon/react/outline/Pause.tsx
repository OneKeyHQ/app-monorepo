import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPause = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M10 21H4V3h6zm-4-2h2V5H6zm14 2h-6V3h6zm-4-2h2V5h-2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPause;
