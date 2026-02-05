import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgImport2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M2 18V6a2 2 0 0 1 2-2h4a1 1 0 0 1 0 2H4v12h16V9a1 1 0 1 1 2 0v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2" />
    <Path d="M11 10a6 6 0 0 1 6-6h4a1 1 0 1 1 0 2h-4a4 4 0 0 0-4 4v2.586l2.043-2.043a1 1 0 1 1 1.414 1.414l-3.75 3.75a1 1 0 0 1-1.414 0l-3.75-3.75a1 1 0 1 1 1.414-1.414L11 12.586z" />
  </Svg>
);
export default SvgImport2;
