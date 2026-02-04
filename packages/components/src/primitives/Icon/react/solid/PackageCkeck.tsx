import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPackageCkeck = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8.757l-1.628-1.629a3 3 0 1 1 4.242-4.242l.129.128 2.379-2.378A3 3 0 0 1 21 12V5a2 2 0 0 0-2-2h-3v4a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2z" />
    <Path d="M14 3h-4v4h4zm7.707 12.707a1 1 0 0 0-1.414-1.414L16.5 18.086l-1.543-1.543a1 1 0 0 0-1.414 1.414l2.25 2.25a1 1 0 0 0 1.414 0z" />
  </Svg>
);
export default SvgPackageCkeck;
