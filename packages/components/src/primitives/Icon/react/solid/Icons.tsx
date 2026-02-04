import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgIcons = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M7 3a1 1 0 0 1 1 1v2h2a1 1 0 1 1 0 2H8v2a1 1 0 1 1-2 0V8H4a1 1 0 0 1 0-2h2V4a1 1 0 0 1 1-1m10 0a4 4 0 1 0 0 8 4 4 0 0 0 0-8m2.828 12.585a1 1 0 1 0-1.414-1.414L17 15.585l-1.414-1.414a1 1 0 0 0-1.414 1.414L15.586 17l-1.414 1.414a1 1 0 1 0 1.414 1.414L17 18.414l1.414 1.414a1 1 0 0 0 1.414-1.414L18.414 17zM5 13a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2z" />
  </Svg>
);
export default SvgIcons;
