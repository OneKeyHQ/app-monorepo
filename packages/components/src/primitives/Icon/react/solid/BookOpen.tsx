import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBookOpen = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M7 4a4 4 0 0 1 4 4v14a2 2 0 0 0-2-2H1V4zm16 0v16h-8a2 2 0 0 0-2 2V8a4 4 0 0 1 4-4z" />
  </Svg>
);
export default SvgBookOpen;
