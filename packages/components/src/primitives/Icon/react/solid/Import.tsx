import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgImport = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M16 4a1 1 0 1 0 0 2h4v12H4V9a1 1 0 0 0-2 0v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
    <Path d="M3 4a1 1 0 0 0 0 2h4a4 4 0 0 1 4 4v2.586l-2.043-2.043a1 1 0 0 0-1.414 1.414l3.75 3.75a1 1 0 0 0 1.414 0l3.75-3.75a1 1 0 0 0-1.414-1.414L13 12.586V10a6 6 0 0 0-6-6z" />
  </Svg>
);
export default SvgImport;
