import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgImport2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M17 4a6 6 0 0 0-6 6v2.586l-2.043-2.043a1 1 0 0 0-1.414 1.414l3.75 3.75a1 1 0 0 0 1.414 0l3.75-3.75a1 1 0 0 0-1.414-1.414L13 12.586V10a4 4 0 0 1 4-4h4a1 1 0 1 0 0-2z" />
    <Path d="M4 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a1 1 0 1 0-2 0v9H4V6h4a1 1 0 0 0 0-2z" />
  </Svg>
);
export default SvgImport2;
