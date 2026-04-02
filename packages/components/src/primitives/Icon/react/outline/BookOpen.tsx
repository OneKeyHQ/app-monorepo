import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBookOpen = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M9 4a4 4 0 0 1 3 1.355A4 4 0 0 1 15 4h8v16h-8a2 2 0 0 0-2 2h-2a2 2 0 0 0-2-2H1V4zM3 18h6a4 4 0 0 1 2 .536V8a2 2 0 0 0-2-2H3zM15 6a2 2 0 0 0-2 2v10.536A4 4 0 0 1 15 18h6V6z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBookOpen;
