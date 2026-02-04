import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBag = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M8 3a1 1 0 0 0-1 1v3H4a1 1 0 0 0-1 1v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a1 1 0 0 0-1-1h-3V4a1 1 0 0 0-1-1zm7 4v4a1 1 0 1 0 2 0V7zM9 7v4a1 1 0 1 1-2 0V7zm0 0h6V5H9z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBag;
