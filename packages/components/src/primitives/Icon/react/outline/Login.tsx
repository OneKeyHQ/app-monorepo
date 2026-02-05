import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLogin = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M19 19V5h-4a1 1 0 1 1 0-2h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4a1 1 0 1 1 0-2zM10.293 7.793a1 1 0 0 1 1.414 0l3.5 3.5a1 1 0 0 1 0 1.414l-3.5 3.5a1 1 0 1 1-1.414-1.414L12.086 13H4a1 1 0 1 1 0-2h8.086l-1.793-1.793a1 1 0 0 1 0-1.414" />
  </Svg>
);
export default SvgLogin;
