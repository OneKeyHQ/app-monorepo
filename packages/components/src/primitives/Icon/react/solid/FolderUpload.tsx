import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFolderUpload = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M2 5a2 2 0 0 1 2-2h5.465a2 2 0 0 1 1.664.89L12.535 6H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-7v-4.586l.793.793a1 1 0 0 0 1.414-1.414l-2.5-2.5a1 1 0 0 0-1.414 0l-2.5 2.5a1 1 0 1 0 1.414 1.414l.793-.793V20H4a2 2 0 0 1-2-2z" />
  </Svg>
);
export default SvgFolderUpload;
