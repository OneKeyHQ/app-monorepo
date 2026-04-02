import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFolderDelete = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m8.414 15-2 2 2 2L7 20.414l-2-2-2 2L1.586 19l2-2-2-2L3 13.586l2 2 2-2z" />
    <Path d="M12.535 6H22v14H10v-2h10V8h-8.535l-2-3H4v7H2V3h8.535z" />
  </Svg>
);
export default SvgFolderDelete;
