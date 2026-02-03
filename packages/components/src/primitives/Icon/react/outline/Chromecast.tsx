import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChromecast = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M3.995 19.898a1 1 0 0 0-.892-.893l-.206-.01A1 1 0 0 1 3 17a3 3 0 0 1 3 3 1 1 0 0 1-1.995.102zM8 20a5 5 0 0 0-5-5 1 1 0 1 1 0-2 7 7 0 0 1 7 7 1 1 0 1 1-2 0m4 0a9 9 0 0 0-9-9 1 1 0 1 1 0-2c6.075 0 11 4.925 11 11a1 1 0 1 1-2 0m8-1V5H4v1a1 1 0 0 1-2 0V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3a1 1 0 1 1 0-2z" />
  </Svg>
);
export default SvgChromecast;
