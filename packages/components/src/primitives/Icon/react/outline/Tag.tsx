import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTag = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11.508 2c.526 0 1.03.21 1.402.581l8.43 8.43a1.984 1.984 0 0 1 0 2.806l-7.523 7.524a1.983 1.983 0 0 1-2.805 0l-8.43-8.43A1.98 1.98 0 0 1 2 11.507V3.984C2 2.888 2.888 2 3.984 2zM7.455 5.967a1.488 1.488 0 1 1 0 2.976 1.488 1.488 0 0 1 0-2.976m-3.471 5.54 8.43 8.431 7.524-7.524-8.43-8.43H3.984z" />
  </Svg>
);
export default SvgTag;
