import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFolderUpload = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M2 18V5a2 2 0 0 1 2-2h5.465a2 2 0 0 1 1.664.89L12.535 6H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-4a1 1 0 1 1 0-2h4V8h-7.465a2 2 0 0 1-1.664-.89L9.465 5H4v13h4a1 1 0 1 1 0 2H4a2 2 0 0 1-2-2m9 1v-3.586l-.793.793a1 1 0 1 1-1.414-1.414l2.5-2.5.076-.068a1 1 0 0 1 1.338.068l2.5 2.5a1 1 0 1 1-1.414 1.414L13 15.414V19a1 1 0 1 1-2 0" />
  </Svg>
);
export default SvgFolderUpload;
