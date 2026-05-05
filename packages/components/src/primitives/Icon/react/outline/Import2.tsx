import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgImport2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M9 6H4v12h16V8h2v12H2V4h7z" />
    <Path d="M22 6h-5a4 4 0 0 0-4 4v2.586l2.75-2.75 1.414 1.414L12 16.414 6.836 11.25 8.25 9.836l2.75 2.75V10a6 6 0 0 1 6-6h5z" />
  </Svg>
);
export default SvgImport2;
