import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgIcons = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M5 15v4h4v-4zm13.414-.83a1 1 0 0 1 1.414 1.415l-1.414 1.414 1.414 1.415a1 1 0 0 1-1.414 1.414L17 18.414l-1.414 1.414a1.001 1.001 0 0 1-1.415-1.414L15.585 17l-1.414-1.414a1 1 0 0 1 1.415-1.414L17 15.585l1.414-1.414ZM6 10V8H4a1 1 0 0 1 0-2h2V4a1 1 0 0 1 2 0v2h2a1 1 0 1 1 0 2H8v2a1 1 0 1 1-2 0m13-3a2 2 0 1 0-4 0 2 2 0 0 0 4 0m-8 12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2zM21 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0" />
  </Svg>
);
export default SvgIcons;
