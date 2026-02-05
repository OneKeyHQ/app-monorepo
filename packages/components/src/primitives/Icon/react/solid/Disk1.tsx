import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDisk1 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M7 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h2v-7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v7h2a2 2 0 0 0 2-2V7.414A2 2 0 0 0 20.414 6L18 3.586a2 2 0 0 0-1-.543V7a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z" />
    <Path d="M15 3H9v4h6zm0 18v-7H9v7z" />
  </Svg>
);
export default SvgDisk1;
