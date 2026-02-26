import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFolderUpload = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12.535 6H22v14h-9v-4.586l1.5 1.5 1.414-1.414L12 11.586 8.086 15.5 9.5 16.914l1.5-1.5V20H2V3h8.535z" />
  </Svg>
);
export default SvgFolderUpload;
