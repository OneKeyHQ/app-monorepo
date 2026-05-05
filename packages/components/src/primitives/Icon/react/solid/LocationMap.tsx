import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLocationMap = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M8 6h3v2H8v8H5.5c-.83 0-1.5.67-1.5 1.5S4.67 19 5.5 19H19v-6h2v8H5.5C3.57 21 2 19.43 2 17.5v-11C2 4.57 3.57 3 5.5 3H8z" />
    <Path d="M17 3.02c2.21 0 4 1.79 4 4 0 1.66-.99 2.91-1.82 3.67-.43.39-.85.69-1.17.89a10 10 0 0 1-.975.513L17 12.11c-.346-.166-.684-.326-1.01-.53-.32-.2-.74-.5-1.17-.89C13.99 9.93 13 8.68 13 7.02c0-2.21 1.79-4 4-4" />
  </Svg>
);
export default SvgLocationMap;
