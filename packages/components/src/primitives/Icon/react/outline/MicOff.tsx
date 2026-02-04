import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMicOff = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11 21v-1.054c-3.553-.37-5.7-2.67-6.824-4.402a1 1 0 1 1 1.677-1.088C6.893 16.058 8.8 18 12 18c1.464 0 2.646-.403 3.599-.987l-1.485-1.485A5 5 0 0 1 7 11V8.414L2.293 3.707a1 1 0 1 1 1.414-1.414l18 18a1 1 0 1 1-1.414 1.414l-3.251-3.25A8.6 8.6 0 0 1 13 19.946V21a1 1 0 1 1-2 0m4-10.656V7a3 3 0 0 0-4.86-2.354 1 1 0 0 1-1.242-1.568A5 5 0 0 1 17 7v3.344a1 1 0 0 1-2 0M9 11a3 3 0 0 0 3.536 2.95L9 10.414z" />
  </Svg>
);
export default SvgMicOff;
