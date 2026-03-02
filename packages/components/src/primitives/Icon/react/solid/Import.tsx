import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgImport = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M22 4v16H2V8h2v10h16V6h-5V4z" />
    <Path d="M7 4a6 6 0 0 1 6 6v2.586l2.75-2.75 1.414 1.414L12 16.414 6.836 11.25 8.25 9.836l2.75 2.75V10a4 4 0 0 0-4-4H2V4z" />
  </Svg>
);
export default SvgImport;
