import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFaceId = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M3 19v-3a1 1 0 1 1 2 0v3h3a1 1 0 1 1 0 2H5a2 2 0 0 1-2-2m16 0v-3a1 1 0 1 1 2 0v3a2 2 0 0 1-2 2h-3a1 1 0 1 1 0-2zm-4.501-4.168a1 1 0 0 1 1.002 1.73A7 7 0 0 1 12 17.5a7 7 0 0 1-3.501-.938 1 1 0 0 1 1.002-1.73A5 5 0 0 0 12 15.5a4.97 4.97 0 0 0 2.499-.668M11.5 11V8.75a1 1 0 1 1 2 0V11a3 3 0 0 1-2.251 2.905 1 1 0 1 1-.498-1.936c.431-.111.749-.505.749-.969M7 10V9a1 1 0 0 1 2 0v1a1 1 0 1 1-2 0m8 0V9a1 1 0 1 1 2 0v1a1 1 0 1 1-2 0M3 8V5a2 2 0 0 1 2-2h3a1 1 0 0 1 0 2H5v3a1 1 0 0 1-2 0m16 0V5h-3a1 1 0 1 1 0-2h3a2 2 0 0 1 2 2v3a1 1 0 1 1-2 0" />
  </Svg>
);
export default SvgFaceId;
