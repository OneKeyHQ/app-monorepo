import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLink = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M5.293 10.293a1 1 0 0 1 1.414 1.414L3.914 14.5 9.5 20.086l2.793-2.793a1 1 0 1 1 1.414 1.414L10.914 21.5a2 2 0 0 1-2.828 0L2.5 15.914a2 2 0 0 1 0-2.828zM13.086 2.5a2 2 0 0 1 2.828 0L21.5 8.086a2 2 0 0 1 .138 2.676l-.138.152-2.793 2.793a1 1 0 0 1-1.414-1.414L20.086 9.5 14.5 3.914l-2.793 2.793a1 1 0 0 1-1.414-1.414z" />
    <Path d="M14.293 8.293a1 1 0 1 1 1.414 1.414l-6 6a1 1 0 1 1-1.414-1.414z" />
  </Svg>
);
export default SvgLink;
