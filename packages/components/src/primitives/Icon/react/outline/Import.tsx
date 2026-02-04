import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgImport = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M2 18V9a1 1 0 0 1 2 0v9h16V6h-4a1 1 0 1 1 0-2h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2" />
    <Path d="M11 10a4 4 0 0 0-4-4H3a1 1 0 0 1 0-2h4a6 6 0 0 1 6 6v2.586l2.043-2.043a1 1 0 1 1 1.414 1.414l-3.75 3.75a1 1 0 0 1-1.414 0l-3.75-3.75a1 1 0 1 1 1.414-1.414L11 12.586z" />
  </Svg>
);
export default SvgImport;
